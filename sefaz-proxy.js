const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.SEFAZ_PROXY_PORT || 8790);
const API_KEY = String(process.env.SEFAZ_PROXY_API_KEY || '').trim();
const UPSTREAM_URL = String(process.env.SEFAZ_UPSTREAM_URL || '').trim();
const UPSTREAM_METHOD = String(process.env.SEFAZ_UPSTREAM_METHOD || 'POST').toUpperCase();
const UPSTREAM_TOKEN = String(process.env.SEFAZ_UPSTREAM_TOKEN || '').trim();

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  });
  res.end(body);
}

function normalizeInput(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function extractAccessKey(raw) {
  const digits = normalizeInput(raw).replace(/\D/g, '');
  if (digits.length === 44) return digits;
  const match = digits.match(/\d{44}/);
  return match ? match[0] : '';
}

function extractNfNumber(raw) {
  const input = normalizeInput(raw);
  if (!input) return '';

  const digits = input.replace(/\D/g, '');
  if (digits.length === 44) {
    return digits.slice(25, 34).replace(/^0+/, '') || '0';
  }

  const embedded = digits.match(/\d{44}/);
  if (embedded) {
    return embedded[0].slice(25, 34).replace(/^0+/, '') || '0';
  }

  return digits || input;
}

function extractXml(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return '';

  const candidates = ['xml', 'xmlContent', 'xml_conteudo', 'conteudoXml', 'conteudo_xml', 'content'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('JSON invalido no body');
  }
}

async function fetchFromUpstream({ codigo, chaveAcesso, numeroNF }) {
  if (!UPSTREAM_URL) {
    throw new Error('SEFAZ_UPSTREAM_URL nao configurada no ambiente do proxy');
  }

  const headers = {
    Accept: 'application/json, text/xml, application/xml, text/plain',
  };
  if (UPSTREAM_TOKEN) {
    headers.Authorization = `Bearer ${UPSTREAM_TOKEN}`;
  }

  let response;
  if (UPSTREAM_METHOD === 'GET') {
    const query = new URLSearchParams();
    query.set('codigo', codigo || '');
    if (chaveAcesso) query.set('chave', chaveAcesso);
    if (numeroNF) query.set('numeroNF', numeroNF);
    response = await fetch(`${UPSTREAM_URL}?${query.toString()}`, {
      method: 'GET',
      headers,
    });
  } else {
    headers['Content-Type'] = 'application/json';
    response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        codigo,
        chaveAcesso,
        numeroNF,
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upstream ${response.status}: ${errText || 'sem detalhes'}`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  let xml = '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    xml = extractXml(data);
  } else {
    xml = await response.text();
  }

  if (!xml || !xml.trim()) {
    throw new Error('Upstream nao retornou XML');
  }

  return xml;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (reqUrl.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'sefaz-proxy',
      upstreamConfigured: Boolean(UPSTREAM_URL),
      port: PORT,
    });
  }

  if (reqUrl.pathname !== '/sefaz/xml') {
    return json(res, 404, { ok: false, error: 'Rota nao encontrada' });
  }

  if (API_KEY) {
    const incoming = String(req.headers['x-api-key'] || '');
    if (incoming !== API_KEY) {
      return json(res, 401, { ok: false, error: 'API key invalida' });
    }
  }

  try {
    let codigo = '';
    if (req.method === 'GET') {
      codigo = String(reqUrl.searchParams.get('codigo') || '').trim();
    } else if (req.method === 'POST') {
      const body = await readJsonBody(req);
      codigo = String(body.codigo || body.numeroNF || body.chaveAcesso || '').trim();
    } else {
      return json(res, 405, { ok: false, error: 'Metodo nao permitido' });
    }

    if (!codigo) {
      return json(res, 400, { ok: false, error: 'codigo obrigatorio' });
    }

    const chaveAcesso = extractAccessKey(codigo);
    const numeroNF = extractNfNumber(codigo);

    const xml = await fetchFromUpstream({ codigo, chaveAcesso, numeroNF });

    return json(res, 200, {
      ok: true,
      numeroNF,
      chaveAcesso,
      xml,
      source: 'sefaz-proxy',
    });
  } catch (error) {
    return json(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SEFAZ Proxy] listening on http://127.0.0.1:${PORT}`);
  if (!UPSTREAM_URL) {
    console.warn('[SEFAZ Proxy] SEFAZ_UPSTREAM_URL nao configurada. Configure para baixar XML.');
  }
});
