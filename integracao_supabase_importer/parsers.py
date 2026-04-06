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

    # Pedido: prioriza DADOS ADICIONAIS (infAdic/infCpl) com regex; fallback para xPed/nPed
    inf_cpl = (
        _find_path_text(root, ["NFe", "infNFe", "infAdic", "infCpl"])
        or _find_path_text(root, ["infNFe", "infAdic", "infCpl"])
        or _find_first_text(root, "infCpl")
    )
    pedido = "-"
    if inf_cpl:
        m_ped = re.search(r"ped(?:ido)?\s*[:\-#n°.\s]{0,3}([A-Z0-9\-\/]{2,30})", inf_cpl, re.IGNORECASE)
        if m_ped:
            pedido = m_ped.group(1).strip()
    if pedido == "-":
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
    total_pcs = 0.0
    total_metros = 0.0
    artigo = "-"
    artigos: List[str] = []

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

        if descricao:
            artigos.append(descricao)

        unidade_normalizada = (unidade or "").strip().lower()
        if unidade_normalizada.startswith("m"):
            total_metros += quantidade
        else:
            # Padrão em APP: quantidade representa peças
            total_pcs += quantidade

        if artigo == "-" and descricao:
            artigo = descricao

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

    if len(artigos) > 1:
        artigo = "; ".join(dict.fromkeys(artigos))  # mantém ordem e remove duplicados

    return {
        "numero_nf": numero_nf,
        "chave_acesso": chave_acesso,
        "serie": serie,
        "pedido": pedido,
        "cliente": cliente,
        "transportadora": transportadora,
        "artigo": artigo,
        "quantidade_itens": total_pcs,
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
        tag = _local_name(elem.tag)
        # JasperPrint pode trazer texto em <text> e/ou <textContent>.
        if tag in ("text", "textContent"):
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
    # Localiza o bloco "TRANSPORTADOR(A) E FRETE" e extrai NOME/RAZÃO SOCIAL
    transportadora = "Nao informada"
    transp_sec_idx = None
    for i, t in enumerate(texts):
        if re.search(r"\bTRANSPORTAD[OA]R\b", t, re.IGNORECASE) and "POR CONTA" not in t.upper() and len(t) < 60:
            transp_sec_idx = i
            break
    if transp_sec_idx is not None:
        search_end = min(transp_sec_idx + 40, len(texts))
        for i in range(transp_sec_idx + 1, search_end):
            t_upper = texts[i].strip().upper()
            # Rótulo "RAZÃO SOCIAL / NOME" ou "NOME / RAZÃO SOCIAL" indica que o próximo texto é o nome
            if ("RAZ" in t_upper and "SOC" in t_upper) or ("NOME" in t_upper and "/" in t_upper and len(texts[i]) < 40):
                for j in range(i + 1, min(i + 6, len(texts))):
                    candidate = texts[j].strip()
                    if (
                        len(candidate) >= 3
                        and not re.fullmatch(r"[0-9.,/\-\s]+", candidate)
                        and "FRETE" not in candidate.upper()
                        and "CNPJ" not in candidate.upper()
                        and "PESO" not in candidate.upper()
                    ):
                        transportadora = candidate
                        break
                if transportadora != "Nao informada":
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
        "QUANT", "QUANTIDADE", "QTD", "PCS", "PEÇAS", "V. UNIT", "V. TOTAL", "BC. ICMS", "V. ICMS", "V. IPI",
        "ALIQ", "IPI", "ALIQ. ICMS", "CST", "DADOS ADICIONAIS",
        "RESERVADO AO FISCO", "DADOS DO PRODUTO / SERVIÇOS", "DADOS DO PRODUTO(S)", "TOTAL",
        "0 - EMITENTE", "1 - EMITENTE",
    }

    def _is_valid_prod_description(value: str) -> bool:
        if not value:
            return False
        txt = value.strip()
        if len(txt) < 5:
            return False
        tupper = txt.upper()
        if tupper in _prod_skip:
            return False
        if any(skip in tupper for skip in ("ALIQ", "IPI", "ICMS", "CST", "PESO", "TOTAL", "CFOP", "NCM")):
            return False
        alpha = sum(1 for c in txt if c.isalpha())
        digit = sum(1 for c in txt if c.isdigit())
        if alpha < 4 or alpha <= digit:
            return False
        if re.fullmatch(r"[\d.,/\-\s]+", txt):
            return False
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", txt):
            return False
        return True

    # Localiza a coluna de produtos e extrai o primeiro item reconhecido como descrição
    _descr_start = None
    for i, t in enumerate(texts):
        if re.search(r"DESCRI[CÇ][AÃ]O\s+DOS\s+PRODUTOS", t, re.IGNORECASE):
            _descr_start = i
            break
    if _descr_start is None:
        for i, t in enumerate(texts):
            if "DADOS DO PRODUTO" in t.upper() or "DADOS DO PRODUTO(S)" in t.upper():
                _descr_start = i
                break

    if _descr_start is not None:
        for j in range(_descr_start + 1, min(_descr_start + 100, len(texts))):
            cand = texts[j].strip()
            if _is_valid_prod_description(cand):
                artigo = cand
                break

    # ── Quantidade / metros ───────────────────────────────────────────────────
    total_qtd = 0.0
    total_metros = 0.0

    # ── Pedido (número no bloco DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES) ─
    pedido = "-"
    dados_adicionais_idx = None
    for i, t in enumerate(texts):
        if re.search(r"DADOS\s+ADICIONAIS", t, re.IGNORECASE):
            dados_adicionais_idx = i
            break
    if dados_adicionais_idx is not None:
        for j in range(dados_adicionais_idx + 1, min(dados_adicionais_idx + 40, len(texts))):
            t = texts[j].strip()
            # Padrão inline: "Pedido: 12345" ou "Ped. 12345" na mesma string
            m_inline = re.search(r"ped(?:ido)?\s*[:\-#n°.\s]{0,3}([A-Z0-9\-\/]{2,30})", t, re.IGNORECASE)
            if m_inline:
                pedido = m_inline.group(1).strip()
                break
            # Rótulo "PEDIDO" isolado → próximo elemento é o número
            if re.fullmatch(r"PEDIDO", t, re.IGNORECASE):
                for k in range(j + 1, min(j + 4, len(texts))):
                    cand = texts[k].strip()
                    if re.fullmatch(r"[A-Z0-9\-\/]{2,20}", cand, re.IGNORECASE):
                        pedido = cand
                        break
                if pedido != "-":
                    break

    # ── Quantidades (PÇS vs METROS) ──────────────────────────────────────────
    # Procura por campos específicos de quantidade e metros
    # A lógica: se houver coluna "METROS" ou unidade iniciada com "m", trata como metro
    # Caso contrário, é quantidade em peças (PÇS)
    for i, t in enumerate(texts):
        t_upper = t.upper()
        
        # Campo de METROS (metro linear específico)
        if t_upper in ("METROS", "METRO", "M"):
            for j in range(i + 1, min(i + 8, len(texts))):
                v = texts[j].strip()
                if re.fullmatch(r"\d+[.,]\d+|\d+", v):
                    total_metros = _to_float(v)
                    break
        
        # Campo de QUANTIDADE em peças
        elif t_upper in ("QUANT", "QUANTIDADE", "PCS", "PEÇAS", "PECAS", "UNIDADE"):
            for j in range(i + 1, min(i + 8, len(texts))):
                v = texts[j].strip()
                if re.fullmatch(r"\d+[.,]\d+|\d+", v):
                    total_qtd = _to_float(v)
                    break

    # ── Extração de múltiplos itens da tabela de produtos ───────────────────
    itens: List[Dict[str, Any]] = []
    
    # Encontra o início da tabela de produtos
    tabela_produtos_idx = None
    for i, t in enumerate(texts):
        if re.search(r"DESCRI[CÇ][AÃ]O\s+DOS\s+PRODUTOS", t, re.IGNORECASE) or "DADOS DO PRODUTO" in t.upper():
            tabela_produtos_idx = i
            break
    
    if tabela_produtos_idx is not None:
        # Procura por descrições de produtos após o cabeçalho da tabela
        produtos_encontrados = []

        def _is_table_header(line: str) -> bool:
            line_up = line.strip().upper()
            return line_up in {
                "COD. PRODUTO", "CÓDIGO PRODUTO", "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS", "DADOS DO PRODUTO", "DADOS DO PRODUTOS", "DADOS DO PRODUTO(S)",
                "NCM / SH", "CFOP", "QUANT", "QUANTIDADE", "V. UNIT", "V. TOTAL", "BC. ICMS", "V. ICMS", "V. IPI", "ALIQ", "IPI", "ALIQ. ICMS", "CST"
            }

        def _is_valid_line(line: str) -> bool:
            if not line or len(line.strip()) < 5:
                return False
            t = line.strip()
            t_up = t.upper()
            if _is_table_header(t):
                return False
            if any(skip in t_up for skip in ("ALIQ", "IPI", "ICMS", "CST", "PESO", "TOTAL", "CFOP", "NCM", "SERIE", "NF")):
                return False
            alpha = sum(1 for c in t if c.isalpha())
            digit = sum(1 for c in t if c.isdigit())
            if alpha < 4 or alpha <= digit:
                return False
            if re.fullmatch(r"[\d.,/\-\s]+", t):
                return False
            if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", t):
                return False
            if re.fullmatch(r"\d{3,8}", t):
                return False
            return True

        row_texts = []
        current_row_parts: List[str] = []

        def _is_section_end(line: str) -> bool:
            upper = line.upper()
            return any(secao in upper for secao in ["DADOS ADICIONAIS", "RESERVADO AO FISCO", "CÁLCULO", "CALCULO", "FATURA", "TRANSPORTADOR"])

        def _is_product_code(line: str) -> bool:
            return bool(re.match(r"^\s*\d+\.[A-Z0-9]+\.[0-9]+\.[0-9]+", line.strip(), re.IGNORECASE))

        for j in range(tabela_produtos_idx + 1, len(texts)):
            t = texts[j].strip()
            if not t:
                continue
            if _is_section_end(t):
                break
            if _is_table_header(t):
                continue

            if _is_product_code(t):
                if current_row_parts:
                    row_texts.append(" ".join(current_row_parts).strip())
                current_row_parts = [t]
            elif current_row_parts:
                current_row_parts.append(t)
            elif _is_valid_line(t):
                row_texts.append(t)

        if current_row_parts:
            row_texts.append(" ".join(current_row_parts).strip())

        for row_text in row_texts:
            if not row_text:
                continue

            descricao = row_text
            codigo = ""
            unidade_item = "un"
            quantidade_item = 0.0
            valor_unitario_item = 0.0
            valor_total_item = 0.0

            m_code = re.match(r"^\s*(?P<code>\d+\.[A-Z0-9]+\.[0-9]+\.[0-9]+)\s+(?P<rest>.+)$", row_text, re.IGNORECASE)
            if m_code:
                codigo = m_code.group("code").strip()
                rest = m_code.group("rest").strip()
                tokens = rest.split()
                ncm_idx = next((i for i, tok in enumerate(tokens) if re.fullmatch(r"\d{8}", tok)), None)
                if ncm_idx is not None and ncm_idx >= 1:
                    descricao = " ".join(tokens[:ncm_idx]).strip()
                    if ncm_idx + 3 < len(tokens):
                        unidade_item = tokens[ncm_idx + 3].strip().lower()
                    if ncm_idx + 4 < len(tokens):
                        quantidade_item = _to_float(tokens[ncm_idx + 4])
                    if ncm_idx + 5 < len(tokens):
                        valor_unitario_item = _to_float(tokens[ncm_idx + 5])
                    if ncm_idx + 6 < len(tokens):
                        valor_total_item = _to_float(tokens[ncm_idx + 6])

            descricao = descricao.strip() or ""
            if not _is_valid_line(descricao):
                continue
            if descricao in produtos_encontrados:
                continue

            produtos_encontrados.append(descricao)
            itens.append({
                "codigo": codigo,
                "descricao": descricao,
                "unidade": unidade_item,
                "quantidade": quantidade_item,
                "valor_unitario": valor_unitario_item,
                "valor_total": valor_total_item,
            })

        # Se encontrou produtos, distribui as quantidades totais entre eles
        if itens and (total_qtd > 0 or total_metros > 0):
            num_itens = len(itens)
            if total_metros > 0:
                # Se tem metros, assume que todos os itens são metros
                metros_por_item = total_metros / num_itens
                for item in itens:
                    item["quantidade"] = metros_por_item
                    item["unidade"] = "m"
            elif total_qtd > 0:
                # Distribui peças igualmente entre os itens
                qtd_por_item = total_qtd / num_itens
                for item in itens:
                    item["quantidade"] = qtd_por_item
                    item["unidade"] = "un"
    
    # Fallback: se não encontrou itens na tabela, cria um item baseado no artigo extraído
    if not itens and artigo and artigo != "-":
        itens.append({
            "codigo": "",
            "descricao": artigo,
            "unidade": "m" if total_metros > 0 else "un",
            "quantidade": total_metros if total_metros > 0 else total_qtd,
            "valor_unitario": 0.0,
            "valor_total": valor_total,
        })

    return {
        "numero_nf": numero_nf,
        "chave_acesso": chave_acesso,
        "serie": "1",
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
        "origem_tipo": "danfe_xml",
        "itens": itens,
    }
