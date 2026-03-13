import glob
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DEFAULT_NF_SOURCE_DIR = r"C:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0"


@dataclass
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    nf_source_dir: str
    poll_seconds: int
    state_file: str
    log_level: str


def get_app_settings_path() -> str:
    """Retorna o caminho para o arquivo de configurações do app."""
    env_path = os.getenv("APP_SETTINGS_FILE")
    if env_path and os.path.isfile(env_path):
        return env_path

    current = Path(__file__).parent
    for _ in range(3):
        candidate = current / "app-settings.json"
        if candidate.exists():
            return str(candidate)
        current = current.parent

    return "./app-settings.json"


def load_app_settings() -> dict:
    """Carrega configurações do app-settings.json se existir."""
    settings_path = get_app_settings_path()
    if not os.path.exists(settings_path):
        return {}

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        print(f"[WARN] Erro ao carregar app-settings.json: {exc}")
        return {}


def expand_env_variables(path_str: str) -> str:
    """Expande variáveis de ambiente como %VAR%, $VAR e {VAR}."""

    def replace_percent(match: re.Match[str]) -> str:
        var_name = match.group(1)
        return os.getenv(var_name, match.group(0))

    def replace_dollar(match: re.Match[str]) -> str:
        var_name = match.group(1)
        return os.getenv(var_name, match.group(0))

    def replace_braces(match: re.Match[str]) -> str:
        var_name = match.group(1)
        return os.getenv(var_name, match.group(0))

    expanded = re.sub(r"%(\w+)%", replace_percent, path_str)
    expanded = re.sub(r"\$(\w+)", replace_dollar, expanded)
    expanded = re.sub(r"\{(\w+)\}", replace_braces, expanded)
    return expanded


def _candidate_patterns(user_profile: str) -> list[str]:
    return [
        DEFAULT_NF_SOURCE_DIR,
        os.path.join(user_profile, "OneDrive*", "*", "nf--app2.0"),
        os.path.join(user_profile, "*OneDrive*", "*", "nf--app2.0"),
        os.path.join(user_profile, "**", "nf--app2.0"),
        os.path.join(user_profile, "**", "LOGISTICA*", "*", "nf-app"),
        os.path.join(user_profile, "*OneDrive*", "*", "LOGISTICA*", "*", "nf-app"),
        os.path.join(user_profile, "OneDrive*", "LOGISTICA*", "*", "nf-app"),
        os.path.join(r"C:\Users", "*", "OneDrive*", "*", "nf--app2.0"),
        os.path.join(r"C:\Users", "*", "OneDrive*", "*", "nf-app"),
        r"\\*\nf--app2.0",
        r"\\*\nf-app",
    ]


def resolve_nf_source_dir(raw_source: str) -> str:
    """Resolve o caminho de origem dos XMLs com fallback automático."""
    source = (raw_source or "").strip()

    if source:
        expanded = expand_env_variables(source)
        if os.path.isdir(expanded):
            print(f"[INFO] Usando caminho configurado: {expanded}")
            return expanded
        print(f"[WARN] Caminho configurado não encontrado: {expanded}")

    user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
    for pattern in _candidate_patterns(user_profile):
        try:
            matches = glob.glob(pattern, recursive=True)
            for match in matches:
                if os.path.isdir(match):
                    print(f"[INFO] Pasta NF encontrada em: {match}")
                    return match
        except Exception:
            continue

    expanded_default = expand_env_variables(DEFAULT_NF_SOURCE_DIR)
    if os.path.isdir(expanded_default):
        return expanded_default

    if source:
        return expand_env_variables(source)

    return ""


def get_settings() -> Settings:
    """Carrega as configurações com prioridade env > app-settings > default."""
    app_settings = load_app_settings()
    nf_source_from_app = str(app_settings.get("nfSourcePath", "")).strip()

    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    nf_source_env = os.getenv("NF_SOURCE_DIR", "").strip()
    chosen_source = nf_source_env or nf_source_from_app or DEFAULT_NF_SOURCE_DIR
    source = resolve_nf_source_dir(chosen_source)

    poll_seconds = int(os.getenv("POLL_SECONDS", "20"))
    if poll_seconds < 1:
        poll_seconds = 20

    state_file = os.getenv("STATE_FILE", "import_state.json").strip() or "import_state.json"
    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"

    if not url:
        raise ValueError("SUPABASE_URL not set")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not set")
    if not source:
        raise ValueError(
            "NF_SOURCE_DIR not set and could not auto-detect XML folder. "
            "Configure NF_SOURCE_DIR or app-settings.json"
        )

    return Settings(
        supabase_url=url,
        supabase_service_role_key=key,
        nf_source_dir=source,
        poll_seconds=poll_seconds,
        state_file=state_file,
        log_level=log_level,
    )
