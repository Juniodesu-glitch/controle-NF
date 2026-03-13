const { parseXmlToNota } = require("../_lib/nf-parser");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function ensureEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} nao configurada`);
  return value;
}

function buildSupabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

async function upsertNota(baseUrl, key, nota) {
  const response = await fetch(`${baseUrl}/rest/v1/nfs?on_conflict=numero_nf`, {
    method: "POST",
    headers: buildSupabaseHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify([
      {
        numero_nf: String(nota.numero_nf || ""),
        chave_acesso: String(nota.chave_acesso || ""),
        serie: String(nota.serie || "1"),
        pedido: String(nota.pedido || "-"),
        cliente: String(nota.cliente || "Cliente nao informado"),
        transportadora: String(nota.transportadora || "Nao informada"),
        artigo: String(nota.artigo || "-"),
        quantidade_itens: Number(nota.quantidade_itens || 0),
        metros: Number(nota.metros || 0),
        peso_bruto: Number(nota.peso_bruto || 0),
        valor_total: Number(nota.valor_total || 0),
        data_emissao: nota.data_emissao || null,
        status: "pendente",
        origem_xml: String(nota.origem_xml || "api:import/xml"),
        xml_conteudo: String(nota.xml_conteudo || ""),
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`Falha upsert nfs ${response.status}: ${await response.text()}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "metodo nao suportado" });
  }

  try {
    const importApiKey = String(process.env.IMPORT_API_KEY || "").trim();
    if (importApiKey) {
      const incoming = String(req.headers["x-api-key"] || "").trim();
      if (incoming !== importApiKey) {
        return res.status(401).json({ ok: false, error: "api key invalida" });
      }
    }

    const body = await readBody(req);
    const xml = String(body.xml || body.xmlContent || "").trim();
    const origem = String(body.origem || body.source || "api:import/xml").trim();

    if (!xml) {
      return res.status(400).json({ ok: false, error: "xml obrigatorio" });
    }

    const nota = parseXmlToNota(xml, origem);
    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const serviceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
    await upsertNota(supabaseUrl, serviceRoleKey, nota);

    return res.status(200).json({
      ok: true,
      numero_nf: nota.numero_nf,
      chave_acesso: nota.chave_acesso,
      origem_xml: nota.origem_xml,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
