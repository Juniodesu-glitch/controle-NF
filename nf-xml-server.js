const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.NF_XML_PORT || 8787);
const XML_BASE_DIR = process.env.NF_XML_DIR ||
  'C:\\Users\\junio.gomes\\Capricórnio Têxtil S.A\\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\\nf-app';

function normalizarNumeroNF(valor) {
  return String(valor || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '') || '0';
}

function decodeXml(valor) {
  return String(valor || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tagRegex(tag, global = false) {
  return new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    global ? 'gi' : 'i'
  );
}

function getFirstTag(xml, tag) {
  const match = tagRegex(tag).exec(xml);
  return match ? decodeXml(match[1].trim()) : '';
}

function getAllTags(xml, tag) {
  const result = [];
  const regex = tagRegex(tag, true);
  let match;

  while ((match = regex.exec(xml)) !== null) {
    result.push(decodeXml(match[1].trim()));
  }

  return result;
}

function getSection(xml, tag) {
  const match = tagRegex(tag).exec(xml);
  return match ? match[1] : '';
}

function toNumber(valor) {
  if (!valor) return 0;
  const bruto = String(valor).trim();
  const temVirgula = bruto.includes(',');
  const temPonto = bruto.includes('.');

  let normalized = bruto;
  if (temVirgula && temPonto) {
    normalized = bruto.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    normalized = bruto.replace(',', '.');
  }

  normalized = normalized.replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAllSections(xml, tag) {
  const result = [];
  const regex = new RegExp(
    `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    'gi'
  );
  let match;

  while ((match = regex.exec(xml)) !== null) {
    result.push(match[1]);
  }

  return result;
}

function listarArquivosXmlRecursivo(diretorioBase) {
  const arquivos = [];
  const pilha = [diretorioBase];

  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (!atual || !fs.existsSync(atual)) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(atual, { withFileTypes: true });
    } catch (error) {
      continue;
    }

    for (const entry of entries) {
      const caminho = path.join(atual, entry.name);
      if (entry.isDirectory()) {
        pilha.push(caminho);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        arquivos.push(caminho);
      }
    }
  }

  return arquivos;
}

function extrairDadosDoXml(xml, arquivo) {
  const ideSection = getSection(xml, 'ide');
  const destSection = getSection(xml, 'dest');
  const transpSection = getSection(xml, 'transp');
  const transportaSection = getSection(transpSection, 'transporta');
  const totalSection = getSection(xml, 'total');
  const icmsTotSection = getSection(totalSection, 'ICMSTot');

  // Lê nNF dentro de <ide> para evitar falsos positivos em outras seções do XML
  const numeroNF = normalizarNumeroNF(getFirstTag(ideSection || xml, 'nNF'));

  // Extrai chave de acesso (chNFe) para validação de consistência interna
  let chaveAcesso = (getFirstTag(xml, 'chNFe') || '').replace(/\D/g, '');
  if (chaveAcesso.length !== 44) {
    const idMatch = xml.match(/<(?:[a-zA-Z0-9_]+:)?infNFe[^>]*\bId\s*=\s*["']NFe(\d{44})["']/i);
    if (idMatch) chaveAcesso = idMatch[1];
  }

  // Valida consistência: nNF deve corresponder ao bloco da chave de acesso
  let xmlValido = Boolean(numeroNF && numeroNF !== '0');
  let motivoInvalido = '';
  if (!xmlValido) {
    motivoInvalido = 'Numero da NF ausente no XML';
  } else if (chaveAcesso.length === 44) {
    const numeroNaChave = normalizarNumeroNF(chaveAcesso.slice(25, 34));
    if (numeroNaChave && numeroNaChave !== numeroNF) {
      xmlValido = false;
      motivoInvalido = `nNF=${numeroNF} nao corresponde a chave de acesso (esperado: ${numeroNaChave})`;
    }
  }

  const cliente = getFirstTag(destSection || xml, 'xNome') || 'Cliente nao informado';
  const transportadora = getFirstTag(transportaSection || transpSection || xml, 'xNome') || 'Nao informada';

  const detSections = getAllSections(xml, 'det');
  const artigos = [];
  const pedidos = [];
  let quantidadeItens = 0;
  let metros = 0;

  detSections.forEach((det) => {
    const prod = getSection(det, 'prod') || det;

    const artigo = getFirstTag(prod, 'xProd');
    if (artigo) artigos.push(artigo);

    const pedidoDet = getFirstTag(prod, 'xPed') || getFirstTag(prod, 'nPed');
    if (pedidoDet) pedidos.push(pedidoDet);

    const qCom = toNumber(getFirstTag(prod, 'qCom'));
    const uCom = (getFirstTag(prod, 'uCom') || '').toUpperCase();

    quantidadeItens += qCom;
    if (uCom.includes('M')) {
      metros += qCom;
    }
  });

  if (quantidadeItens === 0) {
    const qComList = getAllTags(xml, 'qCom');
    quantidadeItens = qComList.reduce((acc, item) => acc + toNumber(item), 0);
  }

  const artigo = artigos.length > 0 ? artigos[0] : '-';
  const pedido = pedidos.length > 0 ? pedidos[0] : (getFirstTag(xml, 'xPed') || getFirstTag(xml, 'nPed') || '-');

  const pesoBList = getAllTags(xml, 'pesoB');
  let pesoBruto = pesoBList.reduce((acc, item) => acc + toNumber(item), 0);
  if (pesoBruto === 0) {
    pesoBruto = toNumber(getFirstTag(icmsTotSection || xml, 'vProd'));
  }

  const valorTotal = toNumber(getFirstTag(icmsTotSection || xml, 'vNF'));
  const dataEmissaoRaw = getFirstTag(xml, 'dhEmi') || getFirstTag(xml, 'dEmi');
  const dataEmissao = dataEmissaoRaw ? dataEmissaoRaw.slice(0, 10) : '';

  return {
    encontrada: xmlValido,
    numeroNF,
    chaveAcesso,
    xmlValido,
    motivoInvalido,
    cliente,
    transportadora,
    artigo,
    pedido,
    quantidadeItens,
    metros,
    pesoBruto,
    valorTotal,
    dataEmissao,
    arquivo,
  };
}

function buscarNFPorNumero(numeroProcurado) {
  const alvo = normalizarNumeroNF(numeroProcurado);
  if (!alvo) return null;

  const arquivosXml = listarArquivosXmlRecursivo(XML_BASE_DIR);

  for (const arquivo of arquivosXml) {
    let xml;
    try {
      xml = fs.readFileSync(arquivo, 'utf8');
    } catch (error) {
      continue;
    }

    const ideXml = getSection(xml, 'ide');
    const numeroXml = normalizarNumeroNF(getFirstTag(ideXml || xml, 'nNF'));
    if (numeroXml !== alvo) continue;

    const dados = extrairDadosDoXml(xml, arquivo);
    if (!dados.xmlValido) {
      // XML encontrado pelo nNF mas com inconsistência interna — registra no console e ignora
      console.warn(`[XML] Arquivo ignorado por inconsistência: ${arquivo} — ${dados.motivoInvalido}`);
      continue;
    }
    return { ...dados, encontrada: true };
  }

  return null;
}

function listarTransportadorasNoDiretorio() {
  const arquivosXml = listarArquivosXmlRecursivo(XML_BASE_DIR);
  const transportadoras = new Set();

  for (const arquivo of arquivosXml) {
    let xml;
    try {
      xml = fs.readFileSync(arquivo, 'utf8');
    } catch (error) {
      continue;
    }

    const transpSection = getSection(xml, 'transp');
    const transportaSection = getSection(transpSection, 'transporta');
    const nome = (getFirstTag(transportaSection || transpSection || xml, 'xNome') || '').trim();
    if (nome) {
      transportadoras.add(nome);
    }
  }

  return Array.from(transportadoras).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function listarNFsNoDiretorio() {
  const arquivosXml = listarArquivosXmlRecursivo(XML_BASE_DIR);
  const nfs = [];

  for (const arquivo of arquivosXml) {
    let xml;
    try {
      xml = fs.readFileSync(arquivo, 'utf8');
    } catch (error) {
      continue;
    }

    const dados = extrairDadosDoXml(xml, arquivo);
    if (dados && dados.numeroNF && dados.numeroNF !== '0') {
      nfs.push(dados);
    }
  }

  return nfs;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: 'URL invalida' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      xmlBaseDir: XML_BASE_DIR,
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === '/api/transportadoras' && req.method === 'GET') {
    if (!fs.existsSync(XML_BASE_DIR)) {
      return sendJson(res, 500, {
        error: 'Diretorio de XML nao encontrado',
        xmlBaseDir: XML_BASE_DIR,
      });
    }

    const transportadoras = listarTransportadorasNoDiretorio();
    return sendJson(res, 200, {
      ok: true,
      total: transportadoras.length,
      transportadoras,
    });
  }

  if (url.pathname === '/api/nfs' && req.method === 'GET') {
    if (!fs.existsSync(XML_BASE_DIR)) {
      return sendJson(res, 500, {
        error: 'Diretorio de XML nao encontrado',
        xmlBaseDir: XML_BASE_DIR,
      });
    }

    const nfs = listarNFsNoDiretorio();
    return sendJson(res, 200, {
      ok: true,
      total: nfs.length,
      nfs,
      xmlBaseDir: XML_BASE_DIR,
    });
  }

  if (url.pathname.startsWith('/api/nf/') && req.method === 'GET') {
    const numero = decodeURIComponent(url.pathname.replace('/api/nf/', '')).trim();
    if (!numero) {
      return sendJson(res, 400, { error: 'Numero da NF nao informado' });
    }

    if (!fs.existsSync(XML_BASE_DIR)) {
      return sendJson(res, 500, {
        error: 'Diretorio de XML nao encontrado',
        xmlBaseDir: XML_BASE_DIR,
      });
    }

    const resultado = buscarNFPorNumero(numero);
    if (!resultado) {
      return sendJson(res, 404, {
        encontrada: false,
        numeroProcurado: normalizarNumeroNF(numero),
      });
    }

    return sendJson(res, 200, resultado);
  }

  return sendJson(res, 404, { error: 'Rota nao encontrada' });
});

server.listen(PORT, () => {
  console.log(`[NF XML API] Rodando em http://127.0.0.1:${PORT}`);
  console.log(`[NF XML API] Pasta base: ${XML_BASE_DIR}`);
});
