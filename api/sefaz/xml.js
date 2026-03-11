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
  const digits = normalizeInput(raw).replace(/\D/g, '');
  if (digits.length === 44) {
    return digits.slice(25, 34).replace(/^0+/, '') || '0';
  }

  const embedded = digits.match(/\d{44}/);
  if (embedded) {
    return embedded[0].slice(25, 34).replace(/^0+/, '') || '0';
  }

  return digits || normalizeInput(raw);
}

function extractXml(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return '';

  const keys = ['xml', 'xmlContent', 'xml_conteudo', 'conteudoXml', 'conteudo_xml', 'content'];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function firstEnv(candidates) {
  for (const key of candidates) {
    const value = String(process.env[key] || '').trim();
    if (value) {
      return { key, value };
    }
  }
  return { key: '', value: '' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  const apiKey = String(process.env.SEFAZ_PROXY_API_KEY || '').trim();
  if (apiKey) {
    const incoming = String(req.headers['x-api-key'] || '');
    if (incoming !== apiKey) {
      return res.status(401).json({ ok: false, error: 'API key invalida' });
    }
  }

  const upstreamUrlCandidates = [
    'SEFAZ_UPSTREAM_URL',
    'SEFAZ_XML_UPSTREAM_URL',
    'SEFAZ_PROXY_UPSTREAM_URL',
    'SEFAZ_XML_PROVIDER_URL',
    'SEFAZ_XML_API_URL',
    // aliases comuns em times que usam prefixo frontend
    'NEXT_PUBLIC_SEFAZ_UPSTREAM_URL',
    'NEXT_PUBLIC_SEFAZ_XML_UPSTREAM_URL',
    // alias curto usado em alguns ambientes
    'SEFAZ_UPSTREAM',
  ];

  const upstreamUrlEnv = firstEnv(upstreamUrlCandidates);
  const upstreamUrl = upstreamUrlEnv.value;

  const selfPath = '/api/sefaz/xml';
  const pointsToSelf = upstreamUrl.includes(selfPath);

  if (!upstreamUrl || pointsToSelf) {
    const available = {};
    for (const key of upstreamUrlCandidates) {
      available[key] = Boolean(String(process.env[key] || '').trim());
    }

    return res.status(503).json({
      ok: false,
      code: 'SEFAZ_UPSTREAM_URL_MISSING',
      error: pointsToSelf
        ? 'URL SEFAZ configurada aponta para o proprio endpoint /api/sefaz/xml (loop). Configure a URL do provedor SEFAZ real.'
        : 'SEFAZ_UPSTREAM_URL nao configurada no ambiente da Vercel',
      checked: available,
    });
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const codigo = String(
      req.query?.codigo || body.codigo || body.numeroNF || body.chaveAcesso || ''
    ).trim();

    if (!codigo) {
      return res.status(400).json({ ok: false, error: 'codigo obrigatorio' });
    }

    const chaveAcesso = extractAccessKey(codigo);
    const numeroNF = extractNfNumber(codigo);
    const upstreamMethodEnv = firstEnv([
      'SEFAZ_UPSTREAM_METHOD',
      'SEFAZ_XML_UPSTREAM_METHOD',
      'SEFAZ_PROXY_UPSTREAM_METHOD',
      'NEXT_PUBLIC_SEFAZ_UPSTREAM_METHOD',
    ]);
    const upstreamMethod = String(upstreamMethodEnv.value || 'POST').toUpperCase();

    const upstreamTokenEnv = firstEnv([
      'SEFAZ_UPSTREAM_TOKEN',
      'SEFAZ_XML_UPSTREAM_TOKEN',
      'SEFAZ_PROXY_UPSTREAM_TOKEN',
      'SEFAZ_XML_PROVIDER_TOKEN',
    ]);
    const upstreamToken = String(upstreamTokenEnv.value || '').trim();

    const headers = {
      Accept: 'application/json, text/xml, application/xml, text/plain',
    };
    if (upstreamToken) {
      headers.Authorization = `Bearer ${upstreamToken}`;
    }

    let upstreamResp;
    if (upstreamMethod === 'GET') {
      const query = new URLSearchParams();
      query.set('codigo', codigo);
      if (chaveAcesso) query.set('chave', chaveAcesso);
      if (numeroNF) query.set('numeroNF', numeroNF);
      const joiner = upstreamUrl.includes('?') ? '&' : '?';
      upstreamResp = await fetch(`${upstreamUrl}${joiner}${query.toString()}`, {
        method: 'GET',
        headers,
      });
    } else {
      headers['Content-Type'] = 'application/json';
      upstreamResp = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ codigo, chaveAcesso, numeroNF }),
      });
    }

    if (!upstreamResp.ok) {
      const err = await upstreamResp.text();
      return res.status(502).json({ ok: false, error: `Upstream ${upstreamResp.status}: ${err || 'sem detalhes'}` });
    }

    const contentType = String(upstreamResp.headers.get('content-type') || '').toLowerCase();
    let xml = '';

    if (contentType.includes('application/json')) {
      const payload = await upstreamResp.json();
      xml = extractXml(payload);
    } else {
      xml = await upstreamResp.text();
    }

    if (!xml.trim()) {
      return res.status(404).json({ ok: false, error: 'XML nao encontrado para o codigo informado' });
    }

    return res.status(200).json({
      ok: true,
      source: 'vercel-api',
      sourceEnv: {
        upstreamUrl: upstreamUrlEnv.key,
        upstreamMethod: upstreamMethodEnv.key || 'DEFAULT_POST',
        upstreamToken: upstreamTokenEnv.key || '',
      },
      numeroNF,
      chaveAcesso,
      xml,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
};
