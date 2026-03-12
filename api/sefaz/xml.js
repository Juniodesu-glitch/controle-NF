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

  // Formato comum da API Qive/Arquivei: { data: [{ access_key, xml }] }
  if (Array.isArray(payload.data) && payload.data.length > 0) {
    for (const doc of payload.data) {
      if (doc && typeof doc.xml === 'string' && doc.xml.trim()) {
        return doc.xml;
      }
    }
  }

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

  const providerEnv = firstEnv([
    'SEFAZ_PROVIDER',
    'SEFAZ_XML_PROVIDER',
    'SEFAZ_UPSTREAM_PROVIDER',
  ]);
  const provider = String(providerEnv.value || '').trim().toLowerCase();

  const qiveBaseUrlEnv = firstEnv([
    'QIVE_BASE_URL',
    'ARQUIVEI_BASE_URL',
    'SEFAZ_QIVE_BASE_URL',
  ]);
  const qiveSandboxEnv = firstEnv([
    'QIVE_SANDBOX',
    'ARQUIVEI_SANDBOX',
  ]);
  const qiveSandbox = ['1', 'true', 'yes', 'on'].includes(
    String(qiveSandboxEnv.value || '').trim().toLowerCase()
  );

  const inferredQiveBaseUrl =
    String(qiveBaseUrlEnv.value || '').trim()
    || (qiveSandbox ? 'https://sandbox-api.arquivei.com.br' : 'https://api.arquivei.com.br');

  const isQiveProvider =
    provider === 'qive'
    || provider === 'arquivei'
    || upstreamUrl.includes('api.arquivei.com.br')
    || upstreamUrl.includes('sandbox-api.arquivei.com.br')
    || Boolean(String(qiveBaseUrlEnv.value || '').trim());

  const effectiveUpstreamUrl = isQiveProvider ? inferredQiveBaseUrl : upstreamUrl;

  const selfPath = '/api/sefaz/xml';
  const pointsToSelf = effectiveUpstreamUrl.includes(selfPath);

  if (!effectiveUpstreamUrl || pointsToSelf) {
    const available = {};
    for (const key of upstreamUrlCandidates) {
      available[key] = Boolean(String(process.env[key] || '').trim());
    }
    available.QIVE_BASE_URL = Boolean(String(process.env.QIVE_BASE_URL || '').trim());
    available.ARQUIVEI_BASE_URL = Boolean(String(process.env.ARQUIVEI_BASE_URL || '').trim());
    available.SEFAZ_PROVIDER = Boolean(String(process.env.SEFAZ_PROVIDER || '').trim());

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

    const upstreamApiIdEnv = firstEnv([
      'SEFAZ_UPSTREAM_API_ID',
      'SEFAZ_XML_UPSTREAM_API_ID',
      'QIVE_API_ID',
      'ARQUIVEI_API_ID',
    ]);
    const upstreamApiId = String(upstreamApiIdEnv.value || '').trim();

    const upstreamApiKeyEnv = firstEnv([
      'SEFAZ_UPSTREAM_API_KEY',
      'SEFAZ_XML_UPSTREAM_API_KEY',
      'QIVE_API_KEY',
      'ARQUIVEI_API_KEY',
    ]);
    const upstreamApiKey = String(upstreamApiKeyEnv.value || '').trim();

    const headers = {
      Accept: 'application/json, text/xml, application/xml, text/plain',
    };
    if (upstreamToken) {
      headers.Authorization = `Bearer ${upstreamToken}`;
    }

    if (isQiveProvider) {
      if (!chaveAcesso) {
        return res.status(400).json({
          ok: false,
          error: 'Para Qive, informe a chave de acesso completa (44 digitos) no codigo bipada.',
        });
      }

      if (!upstreamApiId || !upstreamApiKey) {
        return res.status(503).json({
          ok: false,
          code: 'QIVE_CREDENTIALS_MISSING',
          error: 'Credenciais da API Qive nao configuradas (API-ID/API-KEY).',
          checked: {
            SEFAZ_UPSTREAM_API_ID: Boolean(String(process.env.SEFAZ_UPSTREAM_API_ID || '').trim()),
            SEFAZ_UPSTREAM_API_KEY: Boolean(String(process.env.SEFAZ_UPSTREAM_API_KEY || '').trim()),
            QIVE_API_ID: Boolean(String(process.env.QIVE_API_ID || '').trim()),
            QIVE_API_KEY: Boolean(String(process.env.QIVE_API_KEY || '').trim()),
          },
        });
      }

      const base = effectiveUpstreamUrl.replace(/\/$/, '');
      const qiveQuery = new URLSearchParams();
      qiveQuery.append('access_key[]', chaveAcesso);
      qiveQuery.append('limit', '1');
      qiveQuery.append('format_type', 'xml');
      const qiveUrl = `${base}/v1/nfe/received?${qiveQuery.toString()}`;

      const qiveResp = await fetch(qiveUrl, {
        method: 'GET',
        headers: {
          ...headers,
          'x-api-id': upstreamApiId,
          'x-api-key': upstreamApiKey,
        },
      });

      if (!qiveResp.ok) {
        const err = await qiveResp.text();
        return res.status(502).json({ ok: false, error: `Qive ${qiveResp.status}: ${err || 'sem detalhes'}` });
      }

      const payload = await qiveResp.json();
      const xml = extractXml(payload);

      if (!xml.trim()) {
        return res.status(404).json({ ok: false, error: 'XML nao encontrado na Qive para a chave informada' });
      }

      return res.status(200).json({
        ok: true,
        source: 'qive-api',
        sourceEnv: {
          upstreamUrl: upstreamUrlEnv.key || qiveBaseUrlEnv.key || 'QIVE_DEFAULT_BASE_URL',
          provider: providerEnv.key || 'AUTO_BY_URL',
          upstreamApiId: upstreamApiIdEnv.key || '',
          upstreamApiKey: upstreamApiKeyEnv.key || '',
        },
        numeroNF,
        chaveAcesso,
        xml,
      });
    }

    let upstreamResp;
    if (upstreamMethod === 'GET') {
      const query = new URLSearchParams();
      query.set('codigo', codigo);
      if (chaveAcesso) query.set('chave', chaveAcesso);
      if (numeroNF) query.set('numeroNF', numeroNF);
      const joiner = effectiveUpstreamUrl.includes('?') ? '&' : '?';
      upstreamResp = await fetch(`${effectiveUpstreamUrl}${joiner}${query.toString()}`, {
        method: 'GET',
        headers,
      });
    } else {
      headers['Content-Type'] = 'application/json';
      upstreamResp = await fetch(effectiveUpstreamUrl, {
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
