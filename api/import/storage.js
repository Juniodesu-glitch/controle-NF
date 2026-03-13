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

async function listStorageObjects(baseUrl, key, bucket, prefix) {
  const listUrl = `${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`;
  const response = await fetch(listUrl, {
    method: "POST",
    headers: buildSupabaseHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      prefix: prefix || "",
      limit: 200,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha list storage ${response.status}: ${await response.text()}`);
  }

  const items = await response.json();
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && item.name && String(item.name).toLowerCase().endsWith(".xml"));
}

async function downloadStorageXml(baseUrl, key, bucket, objectPath) {
  const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;

  const response = await fetch(url, {
    method: "GET",
    headers: buildSupabaseHeaders(key),
  });

  if (!response.ok) {
    throw new Error(`Falha download storage ${response.status}: ${await response.text()}`);
  }

  return response.text();
}

async function upsertNota(baseUrl, key, nota) {
  const url = `${baseUrl}/rest/v1/nfs?on_conflict=numero_nf`;
  const response = await fetch(url, {
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
        origem_xml: String(nota.origem_xml || ""),
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

async function addImportLog(baseUrl, key, payload) {
  const url = `${baseUrl}/rest/v1/import_logs`;
  await fetch(url, {
    method: "POST",
    headers: buildSupabaseHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify([payload]),
  }).catch(() => null);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Cron-Secret");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  try {
    const cronSecret = String(process.env.IMPORT_CRON_SECRET || "").trim();
    if (cronSecret) {
      const incoming = String(req.headers["x-cron-secret"] || "").trim();
      const isVercelCron = String(req.headers["x-vercel-cron"] || "").trim() === "1";
      if (incoming !== cronSecret && !isVercelCron) {
        return res.status(401).json({ ok: false, error: "nao autorizado" });
      }
    }

    const body = req.method === "POST" ? await readBody(req) : {};
    const targetNumero = String(req.query.numero || body.numero || "").replace(/\D/g, "");

    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const serviceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
    const bucket = String(process.env.NF_XML_BUCKET || "nf-xml").trim();
    const prefix = String(process.env.NF_XML_PREFIX || "").trim();

    const objects = await listStorageObjects(supabaseUrl, serviceRoleKey, bucket, prefix);
    let total = 0;
    let imported = 0;
    const errors = [];

    for (const object of objects) {
      const objectName = String(object.name || "").trim();
      if (!objectName) continue;

      total += 1;
      const objectPath = prefix ? `${prefix}/${objectName}`.replace(/\/+/g, "/") : objectName;

      try {
        const xml = await downloadStorageXml(supabaseUrl, serviceRoleKey, bucket, objectPath);
        const origem = `storage:${bucket}/${objectPath}`;
        const nota = parseXmlToNota(xml, origem);

        if (targetNumero && String(nota.numero_nf || "") !== targetNumero) {
          continue;
        }

        await upsertNota(supabaseUrl, serviceRoleKey, nota);
        await addImportLog(supabaseUrl, serviceRoleKey, {
          arquivo: origem,
          numero_nf: String(nota.numero_nf || ""),
          chave_acesso: String(nota.chave_acesso || ""),
          status: "sucesso",
          mensagem: "Importado via Vercel storage cron",
        });

        imported += 1;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ object: objectPath, error: msg });
        await addImportLog(supabaseUrl, serviceRoleKey, {
          arquivo: `storage:${bucket}/${objectPath}`,
          numero_nf: "",
          chave_acesso: "",
          status: "erro",
          mensagem: msg.slice(0, 900),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      bucket,
      prefix,
      totalObjects: total,
      imported,
      targetNumero: targetNumero || null,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
