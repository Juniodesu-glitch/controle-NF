import glob
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    nf_source_dir: str
    poll_seconds: int
    state_file: str
    log_level: str


def resolve_nf_source_dir(raw_source: str) -> str:
    source = (raw_source or "").strip()
    if source and os.path.isdir(source):
        return source

    user_profile = os.environ.get("USERPROFILE", r"C:\Users\junio.gomes")
    candidate_patterns = [
        os.path.join(user_profile, "Capric*", "LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos", "nf-app"),
        os.path.join(user_profile, "*", "LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos", "nf-app"),
        os.path.join(r"C:\Users\junio.gomes", "Capric*", "LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos", "nf-app"),
        os.path.join(r"C:\Users\junio.gomes", "*", "LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos", "nf-app"),
    ]

    for pattern in candidate_patterns:
        matches = glob.glob(pattern)
        for match in matches:
            if os.path.isdir(match):
                return match

    return source


def get_settings() -> Settings:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    source = resolve_nf_source_dir(os.getenv("NF_SOURCE_DIR", ""))

    if not url:
        raise ValueError("SUPABASE_URL not set")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not set")
    if not source:
        raise ValueError("NF_SOURCE_DIR not set")

    poll = int(os.getenv("POLL_SECONDS", "3"))
    if poll < 1:
        poll = 3
    state = os.getenv("STATE_FILE", "import_state.json").strip()
    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper()

    return Settings(
        supabase_url=url,
        supabase_service_role_key=key,
        nf_source_dir=source,
        poll_seconds=poll,
        state_file=state,
        log_level=log_level,
    )
