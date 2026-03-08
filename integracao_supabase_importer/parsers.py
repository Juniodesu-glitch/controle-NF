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


def parse_xml_nf(file_path: str) -> Dict[str, Any]:
    tree = ET.parse(file_path)
    root = tree.getroot()

    numero_nf = _normalize_nf_number(_find_first_text(root, "nNF"))
    chave_acesso = _strip_non_digits(_find_first_text(root, "chNFe"))

    # Fallbacks para casos de XML incompleto/fora do padrao de tag nNF.
    if (not numero_nf or numero_nf == "0") and len(chave_acesso) == 44:
        numero_nf = _normalize_nf_number(chave_acesso[25:34])
    if not numero_nf or numero_nf == "0":
        nome_arquivo = os.path.basename(file_path)
        m = re.search(r"(\d{6,10})", nome_arquivo)
        if m:
            numero_nf = _normalize_nf_number(m.group(1))
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

    pedido = _find_first_text(root, "xPed") or _find_first_text(root, "nPed") or "-"
    serie = _find_first_text(root, "serie") or "1"

    data_emissao = _find_first_text(root, "dhEmi") or _find_first_text(root, "dEmi")
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
        return parse_xml_nf(file_path)
    if ext == ".pdf":
        return parse_pdf_nf(file_path)
    raise ValueError(f"Unsupported file extension: {ext}")
