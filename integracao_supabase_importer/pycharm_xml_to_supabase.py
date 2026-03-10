from __future__ import annotations

import json
import os
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Dict, Iterable, Optional

import requests


# ===============================
# CONFIGURE AQUI (PYCHARM)
# ===============================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://SEU-PROJETO.supabase.co").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "SUA_SERVICE_ROLE_KEY").strip()
NF_SOURCE_DIR = os.getenv("NF_SOURCE_DIR", r"C:\CAMINHO\PARA\nf-app").strip()
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "3"))
STATE_FILE = os.getenv("STATE_FILE", "import_state_pycharm.json").strip()


@dataclass
class FileSnapshot:
    mtime: float
    size: int


def parse_decimal(value: str) -> Decimal:
    txt = (value or "").strip().replace(".", "").replace(",", ".")
    if not txt:
        return Decimal("0")
    try:
        return Decimal(txt)
    except InvalidOperation:
        return Decimal("0")


def to_iso_date(value: str) -> Optional[str]:
    txt = (value or "").strip()
    if not txt:
        return None

    # Ex.: 2026-03-10T12:30:00-03:00
    if "T" in txt and len(txt) >= 10:
        return txt[:10]

    # Ex.: 2026-03-10
    if len(txt) == 10 and txt[4] == "-" and txt[7] == "-":
        return txt

    # Ex.: 10/03/2026
    try:
        dt = datetime.strptime(txt, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def strip_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    if ":" in tag:
        return tag.split(":", 1)[1]
    return tag


def iter_elements(root: ET.Element, tag_name: str) -> Iterable[ET.Element]:
    for elem in root.iter():
        if strip_tag(elem.tag) == tag_name:
            yield elem


def first_text(root: ET.Element, tag_name: str, default: str = "") -> str:
    for elem in iter_elements(root, tag_name):
        text = (elem.text or "").strip()
        if text:
            return text
    return default


def parse_xml_nf(xml_path: Path) -> Dict[str, object]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    numero_nf = "".join(ch for ch in first_text(root, "nNF") if ch.isdigit())
    if not numero_nf:
        raise ValueError(f"nNF nao encontrado em {xml_path}")

    serie = first_text(root, "serie", "1")
    cliente = first_text(root, "xNome", "Cliente nao informado")

    transportadora = "Nao informada"
    for transp in iter_elements(root, "transporta"):
        nome = first_text(transp, "xNome", "")
        if nome:
            transportadora = nome
            break

    artigo = first_text(root, "xProd", "-")
    pedido = first_text(root, "xPed", "-")
    if pedido == "-":
        pedido = first_text(root, "nPed", "-")

    quantidade_itens = Decimal("0")
    metros = Decimal("0")
    for prod in iter_elements(root, "prod"):
        qcom = parse_decimal(first_text(prod, "qCom", "0"))
        quantidade_itens += qcom

        unidade = first_text(prod, "uCom", "").upper()
        if "M" in unidade:
            metros += qcom

    peso_bruto = parse_decimal(first_text(root, "pesoB", "0"))
    if peso_bruto == 0:
        peso_bruto = parse_decimal(first_text(root, "vProd", "0"))

    valor_total = parse_decimal(first_text(root, "vNF", "0"))
    data_emissao = to_iso_date(first_text(root, "dhEmi", "") or first_text(root, "dEmi", ""))

    return {
        "numero_nf": numero_nf,
        "serie": serie or "1",
        "pedido": pedido or "-",
        "cliente": cliente or "Cliente nao informado",
        "transportadora": transportadora or "Nao informada",
        "artigo": artigo or "-",
        "quantidade_itens": float(quantidade_itens),
        "metros": float(metros),
        "peso_bruto": float(peso_bruto),
        "valor_total": float(valor_total),
        "data_emissao": data_emissao,
        "status": "pendente",
        "origem_xml": str(xml_path),
    }


def supabase_upsert_nfs_batch(rows: list[Dict[str, object]]) -> None:
    if not rows:
        return

    if "SEU-PROJETO" in SUPABASE_URL or "SUA_SERVICE_ROLE_KEY" in SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no script ou variaveis de ambiente.")

    endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/nfs"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    params = {"on_conflict": "numero_nf"}

    response = requests.post(endpoint, params=params, headers=headers, data=json.dumps(rows), timeout=60)
    if not response.ok:
        raise RuntimeError(f"Erro Supabase {response.status_code}: {response.text}")


def load_state(path: Path) -> Dict[str, Dict[str, float]]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(path: Path, state: Dict[str, Dict[str, float]]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def scan_xml_files(base_dir: Path) -> Iterable[Path]:
    for file in base_dir.rglob("*.xml"):
        if file.is_file():
            yield file


def has_changed(file_path: Path, state: Dict[str, Dict[str, float]]) -> bool:
    stat = file_path.stat()
    key = str(file_path.resolve())
    prev = state.get(key)
    if not prev:
        return True
    return float(prev.get("mtime", -1)) != float(stat.st_mtime) or int(prev.get("size", -1)) != int(stat.st_size)


def mark_state(file_path: Path, state: Dict[str, Dict[str, float]]) -> None:
    stat = file_path.stat()
    key = str(file_path.resolve())
    state[key] = {"mtime": stat.st_mtime, "size": stat.st_size, "updated_at": time.time()}


def run_forever() -> None:
    source = Path(NF_SOURCE_DIR)
    if not source.exists() or not source.is_dir():
        raise RuntimeError(f"NF_SOURCE_DIR invalido: {source}")

    state_path = Path(STATE_FILE)
    state = load_state(state_path)

    print(f"[IMPORTER] Pasta monitorada: {source}")
    print(f"[IMPORTER] Poll: {POLL_SECONDS}s")

    while True:
        batch: list[Dict[str, object]] = []
        changed_files: list[Path] = []

        for xml_file in scan_xml_files(source):
            if not has_changed(xml_file, state):
                continue

            try:
                row = parse_xml_nf(xml_file)
                batch.append(row)
                changed_files.append(xml_file)
            except Exception as exc:
                print(f"[ERRO] Falha ao parsear {xml_file}: {exc}")

            if len(batch) >= 200:
                supabase_upsert_nfs_batch(batch)
                for f in changed_files:
                    mark_state(f, state)
                save_state(state_path, state)
                print(f"[OK] Lote importado: {len(batch)} XML")
                batch.clear()
                changed_files.clear()

        if batch:
            supabase_upsert_nfs_batch(batch)
            for f in changed_files:
                mark_state(f, state)
            save_state(state_path, state)
            print(f"[OK] Lote importado: {len(batch)} XML")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_forever()
