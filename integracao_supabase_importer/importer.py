from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from hashlib import md5
from typing import Dict, Any

from config import get_settings
from parsers import parse_nf_file
from supabase_client import SupabaseClient


@dataclass
class FileState:
    mtime: float
    size: int
    digest: str


def build_digest(file_path: str) -> str:
    hasher = md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_state(state_file: str) -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(state_file):
        return {}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def save_state(state_file: str, state: Dict[str, Dict[str, Any]]) -> None:
    tmp = f"{state_file}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, state_file)


def iter_nf_files(base_dir: str):
    for root, _, files in os.walk(base_dir):
        for name in files:
            lower = name.lower()
            if lower.endswith(".xml") or lower.endswith(".pdf"):
                yield os.path.join(root, name)


def should_import(file_path: str, state: Dict[str, Dict[str, Any]]) -> bool:
    stat = os.stat(file_path)
    key = os.path.abspath(file_path)
    old = state.get(key)
    if not old:
        return True
    if float(old.get("mtime", 0)) != float(stat.st_mtime):
        return True
    if int(old.get("size", 0)) != int(stat.st_size):
        return True
    return False


def mark_imported(file_path: str, state: Dict[str, Dict[str, Any]]) -> None:
    stat = os.stat(file_path)
    digest = build_digest(file_path)
    key = os.path.abspath(file_path)
    state[key] = {
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "digest": digest,
        "imported_at": time.time(),
    }


def process_one_file(client: SupabaseClient, file_path: str, logger: logging.Logger) -> None:
    parsed = parse_nf_file(file_path)

    # Armazena conteudo XML completo para download direto pelo frontend
    if file_path.lower().endswith(".xml"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                parsed["xml_conteudo"] = f.read()
        except Exception:
            try:
                with open(file_path, "r", encoding="latin-1") as f:
                    parsed["xml_conteudo"] = f.read()
            except Exception:
                logger.warning("Nao foi possivel ler conteudo XML: %s", file_path)

    nf_id = client.upsert_nf(parsed)
    client.replace_nf_itens(nf_id, parsed.get("itens", []))

    client.add_import_log(
        arquivo=file_path,
        numero_nf=parsed.get("numero_nf", ""),
        chave_acesso=parsed.get("chave_acesso", ""),
        status="sucesso",
        mensagem="Importado com sucesso",
    )
    logger.info("Importado: %s (NF %s)", file_path, parsed.get("numero_nf"))


def main() -> None:
    settings = get_settings()
    run_once = os.getenv("RUN_ONCE", "0").strip() == "1"
    force_continuous = os.getenv("IMPORTER_FORCE_CONTINUOUS", "0").strip() == "1"
    if force_continuous:
        run_once = False
    force_reimport_all = os.getenv("FORCE_REIMPORT_ALL", "0").strip() == "1"

    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    logger = logging.getLogger("nf-importer")

    if not os.path.isdir(settings.nf_source_dir):
        raise RuntimeError(f"NF_SOURCE_DIR not found: {settings.nf_source_dir}")

    state_file = os.path.abspath(settings.state_file)
    state = load_state(state_file)

    client = SupabaseClient(settings.supabase_url, settings.supabase_service_role_key)

    logger.info("Importer started")
    logger.info("Source dir: %s", settings.nf_source_dir)
    logger.info("Poll seconds: %s", settings.poll_seconds)
    if run_once:
        logger.info("RUN_ONCE enabled: importer will execute a single scan cycle")
    if force_continuous:
        logger.info("IMPORTER_FORCE_CONTINUOUS enabled: RUN_ONCE will be ignored")
    if force_reimport_all:
        logger.info("FORCE_REIMPORT_ALL enabled: all XML/PDF files will be reprocessed")

    while True:
        try:
            changed = 0
            for file_path in iter_nf_files(settings.nf_source_dir):
                if not force_reimport_all and not should_import(file_path, state):
                    continue

                try:
                    process_one_file(client, file_path, logger)
                    mark_imported(file_path, state)
                    changed += 1
                except Exception as exc:
                    logger.exception("Erro ao importar arquivo: %s", file_path)
                    try:
                        client.add_import_log(
                            arquivo=file_path,
                            numero_nf="",
                            chave_acesso="",
                            status="erro",
                            mensagem=str(exc)[:900],
                        )
                    except Exception:
                        logger.warning("Falha ao gravar import_log para erro")

            if changed > 0:
                save_state(state_file, state)

            if run_once:
                logger.info("RUN_ONCE cycle finished. Imported/updated files: %s", changed)
                break

        except Exception:
            logger.exception("Erro no loop principal")

        if run_once:
            break

        time.sleep(settings.poll_seconds)


if __name__ == "__main__":
    main()
