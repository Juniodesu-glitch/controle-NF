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


def get_settings() -> Settings:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    source = os.getenv("NF_SOURCE_DIR", "").strip()

    if not url:
        raise ValueError("SUPABASE_URL not set")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not set")
    if not source:
        raise ValueError("NF_SOURCE_DIR not set")

    poll = int(os.getenv("POLL_SECONDS", "20"))
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
