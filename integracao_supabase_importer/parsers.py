from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

from pypdf import PdfReader


def _strip_non_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _normalize_nf_number(value: str) -> str:
    digits = _strip_non_digits(value)
    return digits.lstrip("0") or "0"


def _to_float(value: str) -> float:
    if not value:
        return 0.0
    text = str(value).strip()
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    text = re.sub(r"[^0-9.-]", "", text)
    try:
        return float(text)
    except Exception:
        return 0.0


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _find_first_text(root: ET.Element, tag_name: str) -> str:
    for elem in root.iter():
        if _local_name(elem.tag) == tag_name:
            return (elem.text or "").strip()
    return ""


def _find_all(root: ET.Element, tag_name: str) -> List[ET.Element]:
    result = []
    for elem in root.iter():
        if _local_name(elem.tag) == tag_name:
            result.append(elem)
    return result


def _find_child_text(parent: ET.Element, child_name: str) -> str:
    if parent is None:
        return ""
    for child in list(parent):
        if _local_name(child.tag) == child_name:
            return (child.text or "").strip()
    return ""


def _find_first_element(root: ET.Element, tag_name: str) -> ET.Element | None:
    for elem in root.iter():
        if _local_name(elem.tag) == tag_name:
            return elem
    return None


def _find_path_text(root: ET.Element, path: List[str]) -> str:
    if root is None:
        return ""

    current_nodes = [root]
    for step in path:
        next_nodes: List[ET.Element] = []
        for node in current_nodes:
            for child in list(node):
                if _local_name(child.tag) == step:
                    next_nodes.append(child)
        if not next_nodes:
            return ""
        current_nodes = next_nodes

    return (current_nodes[0].text or "").strip() if current_nodes else ""


def _extract_chave_acesso(root: ET.Element) -> str:
    chave_tag = _strip_non_digits(_find_first_text(root, "chNFe"))
    if len(chave_tag) == 44:
        return chave_tag

    inf_nfe = _find_first_element(root, "infNFe")
    if inf_nfe is not None:
        attr_id = str(inf_nfe.attrib.get("Id") or "").strip()
        if attr_id.upper().startswith("NFE"):
            digits = _strip_non_digits(attr_id[3:])
            if len(digits) == 44:
                return digits

    return ""


def parse_xml_nf(file_path: str) -> Dict[str, Any]:
    tree = ET.parse(file_path)
    root = tree.getroot()

    numero_nf = _normalize_nf_number(
        _find_path_text(root, ["NFe", "infNFe", "ide", "nNF"])
        or _find_path_text(root, ["infNFe", "ide", "nNF"])
        or _find_first_text(root, "nNF")
    )
    chave_acesso = _extract_chave_acesso(root)

    if (not numero_nf or numero_nf == "0") and len(chave_acesso) == 44:
        numero_nf = _normalize_nf_number(chave_acesso[25:34])

    if not numero_nf or numero_nf == "0":
        raise ValueError(f"XML invalido sem numero NF (nNF): {file_path}")

    if len(chave_acesso) == 44:
        numero_pela_chave = _normalize_nf_number(chave_acesso[25:34])
        if numero_pela_chave != numero_nf:
            raise ValueError(
                f"Inconsistencia XML: nNF={numero_nf} difere da chave={numero_pela_chave} ({file_path})"
            )
    dest = _find_first_element(root, "dest")
    cliente = _find_child_text(dest, "xNome") or "Cliente nao informado"

    # Transportadora: procura xNome dentro de transporta; fallback para qualquer xNome posterior
    transportadora = ""
    for transp in _find_all(root, "transporta"):
        for child in list(transp):
            if _local_name(child.tag) == "xNome" and (child.text or "").strip():
                transportadora = (child.text or "").strip()
                break
        if transportadora:
            break
    if not transportadora:
        transportadora = "Nao informada"

    pedido = (
        _find_path_text(root, ["NFe", "infNFe", "det", "prod", "xPed"])
        or _find_path_text(root, ["infNFe", "det", "prod", "xPed"])
        or _find_first_text(root, "xPed")
        or _find_first_text(root, "nPed")
        or "-"
    )
    serie = (
        _find_path_text(root, ["NFe", "infNFe", "ide", "serie"])
        or _find_path_text(root, ["infNFe", "ide", "serie"])
        or _find_first_text(root, "serie")
        or "1"
    )

    data_emissao = (
        _find_path_text(root, ["NFe", "infNFe", "ide", "dhEmi"])
        or _find_path_text(root, ["NFe", "infNFe", "ide", "dEmi"])
        or _find_path_text(root, ["infNFe", "ide", "dhEmi"])
        or _find_path_text(root, ["infNFe", "ide", "dEmi"])
        or _find_first_text(root, "dhEmi")
        or _find_first_text(root, "dEmi")
    )
    if data_emissao:
        data_emissao = data_emissao[:10]

    valor_total = _to_float(_find_first_text(root, "vNF"))

    peso_bruto = 0.0
    for p in _find_all(root, "pesoB"):
        peso_bruto += _to_float(p.text or "")

    itens: List[Dict[str, Any]] = []
    total_qtd = 0.0
    total_metros = 0.0
    artigo = "-"

    for det in _find_all(root, "det"):
        prod = None
        for child in list(det):
            if _local_name(child.tag) == "prod":
                prod = child
                break
        if prod is None:
            continue

        codigo = ""
        descricao = ""
        unidade = ""
        quantidade = 0.0
        valor_unit = 0.0
        valor_item = 0.0

        for field in list(prod):
            name = _local_name(field.tag)
            text = (field.text or "").strip()
            if name == "cProd":
                codigo = text
            elif name == "xProd":
                descricao = text
            elif name == "uCom":
                unidade = text
            elif name == "qCom":
                quantidade = _to_float(text)
            elif name == "vUnCom":
                valor_unit = _to_float(text)
            elif name == "vProd":
                valor_item = _to_float(text)

        if artigo == "-" and descricao:
            artigo = descricao

        total_qtd += quantidade
        if unidade.upper().startswith("M"):
            total_metros += quantidade

        itens.append(
            {
                "codigo": codigo,
                "descricao": descricao,
                "unidade": unidade,
                "quantidade": quantidade,
                "valor_unitario": valor_unit,
                "valor_total": valor_item,
            }
        )

    return {
        "numero_nf": numero_nf,
        "chave_acesso": chave_acesso,
        "serie": serie,
        "pedido": pedido,
        "cliente": cliente,
        "transportadora": transportadora,
        "artigo": artigo,
        "quantidade_itens": total_qtd,
        "metros": total_metros,
        "peso_bruto": peso_bruto,
        "valor_total": valor_total,
        "data_emissao": data_emissao,
        "status": "pendente",
        "origem_xml": file_path,
        "origem_tipo": "xml",
        "itens": itens,
    }


def parse_pdf_nf(file_path: str) -> Dict[str, Any]:
    # Extracao simples por regex; PDF de NF pode variar bastante.
    # Recomendado usar XML quando disponivel.
    reader = PdfReader(file_path)
    text = "\n".join((page.extract_text() or "") for page in reader.pages)

    numero_match = re.search(r"\bNF\b\D{0,10}(\d{4,9})", text, re.IGNORECASE)
    numero_nf = _normalize_nf_number(numero_match.group(1) if numero_match else "")

    pedido_match = re.search(r"\bPEDIDO\b\D{0,8}([A-Z0-9\-\/]{3,30})", text, re.IGNORECASE)
    pedido = pedido_match.group(1) if pedido_match else "-"

    cliente_match = re.search(r"\bCLIENTE\b\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    cliente = (cliente_match.group(1).strip() if cliente_match else "Cliente nao informado")[:180]

    transp_match = re.search(r"\bTRANSP(?:ORTADORA)?\b\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    transportadora = (transp_match.group(1).strip() if transp_match else "Nao informada")[:120]

    peso_match = re.search(r"\bPESO\s*BRUTO\b\D{0,8}([0-9\.,]+)", text, re.IGNORECASE)
    peso_bruto = _to_float(peso_match.group(1) if peso_match else "0")

    valor_match = re.search(r"\bVALOR\s*TOTAL\b\D{0,8}([0-9\.,]+)", text, re.IGNORECASE)
    valor_total = _to_float(valor_match.group(1) if valor_match else "0")

    if not numero_nf:
        raise ValueError("Nao foi possivel extrair numero da NF do PDF")

    return {
        "numero_nf": numero_nf,
        "chave_acesso": "",
        "serie": "1",
        "pedido": pedido,
        "cliente": cliente,
        "transportadora": transportadora,
        "artigo": "-",
        "quantidade_itens": 0.0,
        "metros": 0.0,
        "peso_bruto": peso_bruto,
        "valor_total": valor_total,
        "data_emissao": None,
        "status": "pendente",
        "origem_xml": file_path,
        "origem_tipo": "pdf",
        "itens": [],
    }


def parse_nf_file(file_path: str) -> Dict[str, Any]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".xml":
        try:
            tree = ET.parse(file_path)
        except ET.ParseError as exc:
            raise ValueError(f"XML invalido ({file_path}): {exc}") from exc
        root = tree.getroot()
        if _is_jasperprint_xml(root):
            return parse_danfe_jasperprint_xml(file_path)
        return parse_xml_nf(file_path)
    if ext == ".pdf":
        return parse_pdf_nf(file_path)
    raise ValueError(f"Unsupported file extension: {ext}")


# ─────────────────────────────────────────────────────────────────────────────
# DANFE JasperPrint XML parser (formato exportado pelo Systextil / JasperReports)
# ─────────────────────────────────────────────────────────────────────────────

def _is_jasperprint_xml(root: ET.Element) -> bool:
    """Retorna True se o XML é um documento JasperReports (DANFE visual)."""
    local = _local_name(root.tag)
    ns = root.tag
    return "jasperPrint" in local or "jasperreports" in str(ns).lower()


def _jasperprint_texts(root: ET.Element) -> List[str]:
    """Extrai todos os elementos de texto do JasperPrint, ignorando dados base64."""
    result: List[str] = []
    for elem in root.iter():
        if _local_name(elem.tag) == "text":
            t = (elem.text or "").strip()
            # Ignora blobs base64 (strings longas só com chars alfanuméricos)
            if t and len(t) <= 500 and not re.fullmatch(r"[A-Za-z0-9+/=]{60,}", t):
                result.append(t)
    return result


def parse_danfe_jasperprint_xml(file_path: str) -> Dict[str, Any]:
    """Parseia DANFE no formato JasperReports exportado pelo Systextil."""
    tree = ET.parse(file_path)
    root = tree.getroot()
    texts = _jasperprint_texts(root)
    joined = "\n".join(texts)

    # ── Chave de acesso (44 dígitos, possivelmente com espaços a cada 4) ─────
    chave_acesso = ""
    m_chave = re.search(r"\b(\d{4}(?:\s+\d{4}){10})\b", joined)
    if m_chave:
        chave_acesso = re.sub(r"\D", "", m_chave.group(1))
    if len(chave_acesso) != 44:
        for t in texts:
            digits = re.sub(r"\D", "", t)
            if len(digits) == 44:
                chave_acesso = digits
                break

    # ── Número da NF ─────────────────────────────────────────────────────────
    numero_nf = ""
    if len(chave_acesso) == 44:
        numero_nf = _normalize_nf_number(chave_acesso[25:34])
    if not numero_nf or numero_nf == "0":
        # Fallback: número com zeros à esquerda (ex: "000400200")
        for t in texts:
            if re.fullmatch(r"0{1,6}\d{3,8}", t):
                numero_nf = _normalize_nf_number(t)
                break
    if not numero_nf or numero_nf == "0":
        raise ValueError(f"DANFE JasperPrint sem numero NF identificavel: {file_path}")

    # ── Data de emissão ───────────────────────────────────────────────────────
    data_emissao = ""
    for t in texts:
        m_date = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", t)
        if m_date:
            data_emissao = f"{m_date.group(3)}-{m_date.group(2)}-{m_date.group(1)}"
            break

    # ── Valor total da nota ───────────────────────────────────────────────────
    valor_total = 0.0
    for i, t in enumerate(texts):
        if t.upper() == "VALOR TOTAL DA NOTA":
            for j in range(i + 1, min(i + 8, len(texts))):
                v = texts[j].strip()
                if re.fullmatch(r"\d[\d.,]*", v):
                    valor_total = _to_float(v)
                    break
            break

    # ── Peso bruto ────────────────────────────────────────────────────────────
    peso_bruto = 0.0
    for i, t in enumerate(texts):
        if t.upper() == "PESO BRUTO":
            for j in range(i + 1, min(i + 6, len(texts))):
                v = texts[j].strip()
                if re.fullmatch(r"\d[\d.,]*", v):
                    peso_bruto = _to_float(v)
                    break
            break

    # ── Transportadora ────────────────────────────────────────────────────────
    # Busca elemento de texto com palavras-chave de empresa transportadora
    transportadora = "Nao informada"
    _transp_kw = re.compile(
        r"\b(?:TRANSPORT(?:E|ES|ADORA)?|LOG[IÍ]STICA|EXPRESSO|CARGAS?|COURIER|FRETE)\b",
        re.IGNORECASE,
    )
    _transp_excl = re.compile(
        r"\b(?:VOLUME|TRANSPORTAD[OR]|POR CONTA|FRETE POR)\b", re.IGNORECASE
    )
    for t in texts:
        if _transp_kw.search(t) and not _transp_excl.search(t) and len(t.split()) >= 2:
            transportadora = t
            break

    # ── Cliente (destinatário) ─────────────────────────────────────────────────
    # Nome da empresa do destinatário: geralmente contém LTDA, S/A, EIRELI, etc.
    cliente = "Cliente nao informado"
    _company_kw = re.compile(
        r"\b(?:LTDA|EIRELI|EPP|ME\b|S\.?/?A\.?|INDUSTRIA|INDÚSTRIA|COMERCIO|COMÉRCIO)\b",
        re.IGNORECASE,
    )
    # Encontra a seção "DESTINATÁRIO/REMETENTE" e procura nome de empresa dentro dela
    dest_idx = None
    for i, t in enumerate(texts):
        if "DESTINAT" in t.upper() and "REMETENTE" in t.upper():
            dest_idx = i
            break
    search_start = dest_idx + 1 if dest_idx is not None else 0
    end_section = len(texts)
    for i in range(search_start, len(texts)):
        if any(kw in texts[i].upper() for kw in ("FATURA", "CÁLCULO", "CALCULO", "IMPOSTO")):
            end_section = i
            break
    for t in texts[search_start:end_section]:
        if (
            _company_kw.search(t)
            and t != transportadora
            and len(t) >= 6
            and "CAPRICORNIO" not in t.upper()
            and "CAPRICÓRNIO" not in t.upper()
        ):
            cliente = t
            break
    if cliente == "Cliente nao informado":
        # Busca mais ampla: qualquer nome de empresa fora do emitente
        for t in texts:
            if (
                _company_kw.search(t)
                and t != transportadora
                and len(t) >= 6
                and "CAPRICORNIO" not in t.upper()
                and "CAPRICÓRNIO" not in t.upper()
            ):
                cliente = t
                break

    # ── Artigo (descrição do produto) ─────────────────────────────────────────
    artigo = "-"
    _prod_skip = {
        "COD. PRODUTO", "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS", "NCM / SH", "CFOP",
        "QUANT", "V. UNIT", "V. TOTAL", "BC. ICMS", "V. ICMS", "V. IPI",
        "ALIQ", "IPI", "ALIQ. ICMS", "CST", "DADOS ADICIONAIS",
        "RESERVADO AO FISCO", "DADOS DO PRODUTO / SERVIÇOS",
        "0 - EMITENTE", "1 - EMITENTE",
    }
    prod_idx = None
    for i, t in enumerate(texts):
        if "DADOS DO PRODUTO" in t.upper():
            prod_idx = i
            break
    if prod_idx is not None:
        for j in range(prod_idx + 1, min(prod_idx + 80, len(texts))):
            t = texts[j].strip()
            if (
                len(t) >= 10
                and t.upper() not in _prod_skip
                and not re.fullmatch(r"[\d.,/\-]+", t)
                and not re.fullmatch(r"\d{3,8}", t)
            ):
                artigo = t
                break

    # ── Quantidade / metros ───────────────────────────────────────────────────
    total_qtd = 0.0
    total_metros = 0.0
    for i, t in enumerate(texts):
        if t.upper() in ("QUANT", "QUANTIDADE"):
            for j in range(i + 1, min(i + 30, len(texts))):
                v = texts[j].strip()
                if re.fullmatch(r"\d+[.,]\d+", v):
                    total_qtd = _to_float(v)
                    if total_qtd >= 1:
                        total_metros = total_qtd
                    break
            break

    return {
        "numero_nf": numero_nf,
        "chave_acesso": chave_acesso,
        "serie": "1",
        "pedido": "-",
        "cliente": cliente,
        "transportadora": transportadora,
        "artigo": artigo,
        "quantidade_itens": total_qtd,
        "metros": total_metros,
        "peso_bruto": peso_bruto,
        "valor_total": valor_total,
        "data_emissao": data_emissao,
        "status": "pendente",
        "origem_xml": file_path,
        "origem_tipo": "danfe_xml",
        "itens": [],
    }
