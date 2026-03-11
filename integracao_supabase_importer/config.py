import glob
import json
import os
from dataclasses import dataclass
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()


@dataclass
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    nf_source_dir: str
    poll_seconds: int
    state_file: str
    log_level: str


def get_app_settings_path() -> str:
    """Retorna o caminho para o arquivo de configurações do app"""
    # Procura em:
    # 1. Diretório pai (onde está o projeto)
    # 2. Variável de ambiente
    # 3. Padrão: ./app-settings.json
    
    env_path = os.getenv("APP_SETTINGS_FILE")
    if env_path and os.path.isfile(env_path):
        return env_path
    
    # Tenta encontrar na pasta pai (sobe até 3 níveis)
    current = Path(__file__).parent
    for _ in range(3):
        candidate = current / "app-settings.json"
        if candidate.exists():
            return str(candidate)
        current = current.parent
    
    return "./app-settings.json"


def load_app_settings() -> dict:
    """Carrega configurações do app-settings.json se existir"""
    settings_path = get_app_settings_path()
    
    if not os.path.exists(settings_path):
        return {}
    
    try:
        with open(settings_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Erro ao carregar app-settings.json: {e}")
        return {}


def expand_env_variables(path_str: str) -> str:
    """
    Expande variáveis de ambiente como %USERPROFILE%, $HOME, etc
    Suporta: %VAR%, $VAR, {VAR}
    """
    import re
    
    def replace_var(match):
        var_name = match.group(1)
        return os.getenv(var_name, match.group(0))
    
    # Padrões: %VAR%, $VAR, {VAR}
    expanaded = re.sub(r'%(\w+)%|$(\w+)|\{(\w+)\}', 
                       lambda m: replace_var(m) if m.group(1) else (
                           replace_var(m) if m.group(2) else replace_var(m)
                       ),
                       path_str)
    
    return expanaded if expanaded != path_str else path_str


def resolve_nf_source_dir(raw_source: str) -> str:
    """
    Resolve o caminho de origem dos XMLs com fallback automático
    Prioridade:
    1. Caminho informado se válido
    2. Padrões OneDrive locais
    3. Padrões de rede (UNC)
    """
    source = (raw_source or "").strip()
    
    # Se foi fornecido um caminho e existe, use-o
    if source:
        expanded = expand_env_variables(source)
        if os.path.isdir(expanded):
            print(f"✓ Usando caminho configurado: {expanded}")
            return expanded
        print(f"⚠️  Caminho configurado não encontrado: {expanded}")
    
    user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
    
    # Padrões para procurar
    candidate_patterns = [
        # OneDrive sincronizado - padrões comuns
        os.path.join(user_profile, "**", "LOGISTICA*", "*", "nf-app"),
        os.path.join(user_profile, "*OneDrive*", "*", "LOGISTICA*", "*", "nf-app"),
        os.path.join(user_profile, "OneDrive*", "LOGISTICA*", "*", "nf-app"),
        os.path.join(user_profile, "Capric*", "LOGISTICA*", "*", "nf-app"),
        os.path.join(r"C:\Users", "*", "OneDrive*", "*", "nf-app"),
        os.path.join(r"C:\Users", "*", "Capric*", "LOGISTICA*", "*", "nf-app"),
        # Caminhos em rede (UNC)
        r"\\*\LOGISTICA*\*\nf-app",
        r"\\*\nf-app",
    ]
    
    for pattern in candidate_patterns:
        try:
            matches = glob.glob(pattern, recursive=True)
            for match in matches:
                if os.path.isdir(match):
                    print(f"✓ Pasta NF encontrada em: {match}")
                    return match
        except Exception as e:
            continue
    
    # Se nada foi encontrado, retorna o último valor (pode estar offline)
    if source:
        return expand_env_variables(source)
    
    return ""


def get_settings() -> Settings:
    """Carrega as configurações, com prioridade: app-settings.json > env > defaults"""
    
    # 1. Tenta carregar do app-settings.json
    app_settings = load_app_settings()
    nf_source_from_app = app_settings.get("nfSourcePath", "")
    
    # 2. Variáveis de ambiente (sobrescrevem app-settings)
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    
    # Caminho de origem: prefer env > app-settings > defaults
    nf_source_env = os.getenv("NF_SOURCE_DIR", "").strip()
    if nf_source_env:
        source = resolve_nf_source_dir(nf_source_env)
    elif nf_source_from_app:
        source = resolve_nf_source_dir(nf_source_from_app)
    else:
        source = resolve_nf_source_dir("")  # Tenta descobrir automaticamente
    
    poll_seconds = int(os.getenv("POLL_SECONDS", "20"))
    state_file = os.getenv("STATE_FILE", "import_state.json")
    log_level = os.getenv("LOG_LEVEL", "INFO")
    
    if not url:
        raise ValueError("SUPABASE_URL not set")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not set")
    if not source:
        raise ValueError(
            "NF_SOURCE_DIR not set and could not auto-detect nf-app folder. "
            "Configure via variável de ambiente NF_SOURCE_DIR ou app-settings.json"
        )
    
    return Settings(
        supabase_url=url,
        supabase_service_role_key=key,
        nf_source_dir=source,
        poll_seconds=poll_seconds,
        state_file=state_file,
        log_level=log_level,
    )

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
