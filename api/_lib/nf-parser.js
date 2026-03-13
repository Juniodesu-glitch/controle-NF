function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toNumber(value) {
  const cleaned = String(value || "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function firstTag(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const match = String(xml || "").match(re);
  return decodeXmlEntities(match ? match[1] : "");
}

function allBlocks(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "gi");
  const list = [];
  let match;
  while ((match = re.exec(String(xml || ""))) !== null) {
    list.push(match[1]);
  }
  return list;
}

function firstTagInBlock(xml, blockTag, targetTag) {
  const blockRe = new RegExp(`<(?:\\w+:)?${blockTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${blockTag}>`, "i");
  const blockMatch = String(xml || "").match(blockRe);
  if (!blockMatch || !blockMatch[1]) return "";
  return firstTag(blockMatch[1], targetTag);
}

function extractAccessKey(xml) {
  const chNfe = normalizeDigits(firstTag(xml, "chNFe"));
  if (chNfe.length === 44) return chNfe;

  const infId = String(xml || "").match(/<(?:\\w+:)?infNFe[^>]*\sId=["']NFe(\d{44})["']/i);
  if (infId && infId[1]) return infId[1];

  return "";
}

function parseXmlToNota(xmlContent, origemPath) {
  const xml = String(xmlContent || "").trim();
  if (!xml) {
    throw new Error("XML vazio");
  }

  const chaveAcesso = extractAccessKey(xml);
  let numeroNf = normalizeDigits(firstTag(xml, "nNF")).replace(/^0+/, "");
  if (!numeroNf && chaveAcesso.length === 44) {
    numeroNf = chaveAcesso.slice(25, 34).replace(/^0+/, "");
  }

  if (!numeroNf) {
    throw new Error("Nao foi possivel extrair numero da NF");
  }

  const serie = firstTag(xml, "serie") || "1";
  const cliente = firstTagInBlock(xml, "dest", "xNome") || "Cliente nao informado";
  const transportadora =
    firstTagInBlock(xml, "transporta", "xNome")
    || firstTagInBlock(xml, "transp", "xNome")
    || "Nao informada";
  const pedido = firstTag(xml, "xPed") || firstTag(xml, "nPed") || "-";
  const dataEmissaoRaw = firstTag(xml, "dhEmi") || firstTag(xml, "dEmi");
  const dataEmissao = dataEmissaoRaw ? dataEmissaoRaw.slice(0, 10) : null;
  const valorTotal = toNumber(firstTag(xml, "vNF"));
  const pesoBruto = toNumber(firstTag(xml, "pesoB"));

  const detBlocks = allBlocks(xml, "det");
  const itens = detBlocks.map((det) => {
    const prodMatch = det.match(/<(?:\w+:)?prod>([\s\S]*?)<\/(?:\w+:)?prod>/i);
    const prod = prodMatch ? prodMatch[1] : det;
    return {
      codigo: firstTag(prod, "cProd"),
      descricao: firstTag(prod, "xProd"),
      unidade: firstTag(prod, "uCom"),
      quantidade: toNumber(firstTag(prod, "qCom")),
      valor_unitario: toNumber(firstTag(prod, "vUnCom")),
      valor_total: toNumber(firstTag(prod, "vProd")),
    };
  });

  const artigo = (itens.find((i) => i.descricao) || {}).descricao || firstTag(xml, "xProd") || "-";
  const quantidadeItens = itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  const metros = quantidadeItens;

  return {
    numero_nf: numeroNf,
    chave_acesso: chaveAcesso,
    serie,
    pedido,
    cliente,
    transportadora,
    artigo,
    quantidade_itens: quantidadeItens,
    metros,
    peso_bruto: pesoBruto,
    valor_total: valorTotal,
    data_emissao: dataEmissao,
    status: "pendente",
    origem_xml: String(origemPath || ""),
    xml_conteudo: xml,
    itens,
  };
}

module.exports = {
  parseXmlToNota,
};
