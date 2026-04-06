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

function normalizeHeader(header) {
  return String(header || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "").trim();
}

function mapNfRowToPayload(row) {
  const payload = {
    numero_nf: null,
    serie: "1",
    pedido: "-",
    cliente: "Cliente nao informado",
    transportadora: "Nao informada",
    artigo: "-",
    quantidade_itens: 0,
    metros: 0,
    peso_bruto: 0,
    valor_total: 0,
    data_emissao: null,
    status: "pendente",
    origem_xml: "api:import/nf-base",
    xml_conteudo: "",
  };

  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeHeader(key);
    const textValue = String(value ?? "").trim();

    if (["numeronf", "numero", "nf", "numeronota", "numeronotafiscal"].includes(normalized)) {
      payload.numero_nf = normalizeNumber(textValue);
      return;
    }
    if (["serie", "serienf"].includes(normalized)) {
      payload.serie = textValue || "1";
      return;
    }
    if (["pedido", "ordem", "order", "numeroordem"].includes(normalized)) {
      payload.pedido = textValue || "-";
      return;
    }
    if (["cliente", "destinatario", "nomecliente", "razaosocial"].includes(normalized)) {
      payload.cliente = textValue || "Cliente nao informado";
      return;
    }
    if (["transportadora", "transportadora_nf", "nome_transportadora"].includes(normalized)) {
      payload.transportadora = textValue || "Nao informada";
      return;
    }
    if (["artigo", "produto", "descricao", "descricaoproduto", "descricao_produto"].includes(normalized)) {
      payload.artigo = textValue || "-";
      return;
    }
    if (["quantidadeitens", "quantidade_itens", "qtditens", "itens", "quantidade"].includes(normalized)) {
      payload.quantidade_itens = Number(textValue.replace(/[^0-9.,-]/g, "")) || 0;
      return;
    }
    if (["metros", "m", "metro"].includes(normalized)) {
      payload.metros = Number(textValue.replace(/[^0-9.,-]/g, "")) || 0;
      return;
    }
    if (["pesobruto", "peso_bruto", "peso"].includes(normalized)) {
      payload.peso_bruto = Number(textValue.replace(/[^0-9.,-]/g, "")) || 0;
      return;
    }
    if (["valortotal", "valor_total", "valor", "total"].includes(normalized)) {
      payload.valor_total = Number(textValue.replace(/[^0-9.,-]/g, "")) || 0;
      return;
    }
    if (["dataemissao", "data_emissao", "emissao", "data"].includes(normalized)) {
      payload.data_emissao = textValue || null;
      return;
    }
    if (["status"].includes(normalized)) {
      payload.status = textValue || "pendente";
      return;
    }
    if (["origemxml", "origem_xml", "origem"].includes(normalized)) {
      payload.origem_xml = textValue || "api:import/nf-base";
      return;
    }
    if (["xmlconteudo", "xml_conteudo", "xml"].includes(normalized)) {
      payload.xml_conteudo = textValue || "";
      return;
    }
  });

  if (!payload.numero_nf) {
    payload.numero_nf = normalizeNumber(String(row.numero_nf || row.numero || row.NF || row.NF || ""));
  }

  return payload;
}

async function postBaseToSupabase(baseUrl, serviceRoleKey, rows) {
  const payloads = rows
    .map(mapNfRowToPayload)
    .filter((item) => item.numero_nf && item.numero_nf.length > 0);

  if (payloads.length === 0) {
    throw new Error("Nenhuma nota fiscal valida encontrada na base.");
  }

  const response = await fetch(`${baseUrl}/rest/v1/nfs?on_conflict=numero_nf`, {
    method: "POST",
    headers: buildSupabaseHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(payloads),
  });

  if (!response.ok) {
    throw new Error(`Falha ao importar base: ${response.status} ${await response.text()}`);
  }

  const rowsInserted = await response.json();
  return Array.isArray(rowsInserted) ? rowsInserted : [];
}

async function queryNfByNumero(baseUrl, serviceRoleKey, numero) {
  const normalized = normalizeNumber(numero);
  if (!normalized) return null;

  const response = await fetch(
    `${baseUrl}/rest/v1/nfs?select=*&numero_nf=eq.${encodeURIComponent(normalized)}&limit=1`,
    {
      method: "GET",
      headers: buildSupabaseHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Falha na consulta de NF: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  try {
    const importApiKey = String(process.env.IMPORT_API_KEY || "").trim();
    if (importApiKey) {
      const incoming = String(req.headers["x-api-key"] || "").trim();
      if (incoming !== importApiKey) {
        return res.status(401).json({ ok: false, error: "api key invalida" });
      }
    }

    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const serviceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (req.method === "POST") {
      const body = await readBody(req);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length === 0) {
        return res.status(400).json({ ok: false, error: "rows obrigatorio" });
      }

      const inserted = await postBaseToSupabase(supabaseUrl, serviceRoleKey, rows);
      return res.status(200).json({ ok: true, imported: inserted.length, rows: inserted });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const numero = String(url.searchParams.get("numero") || "").trim();
      if (!numero) {
        return res.status(400).json({ ok: false, error: "parametro numero obrigatorio" });
      }

      const row = await queryNfByNumero(supabaseUrl, serviceRoleKey, numero);
      if (!row) {
        return res.status(404).json({ ok: false, encontrada: false, numero });
      }
      return res.status(200).json({ ok: true, encontrada: true, nf: row });
    }

    return res.status(405).json({ ok: false, error: "metodo nao suportado" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
