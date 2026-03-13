import os
import requests
from msal import ConfidentialClientApplication

# Configurações do Azure/Graph API
CLIENT_ID = os.environ.get('MS_CLIENT_ID')
CLIENT_SECRET = os.environ.get('MS_CLIENT_SECRET')
TENANT_ID = os.environ.get('MS_TENANT_ID')
USER_EMAIL = os.environ.get('MS_USER_EMAIL')  # Email do dono do OneDrive
ONEDRIVE_FOLDER = os.environ.get('ONEDRIVE_FOLDER', 'nf--app2.0')

# Configurações do Supabase
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

# 1. Autenticação no Microsoft Graph
app = ConfidentialClientApplication(
    client_id=CLIENT_ID,
    client_credential=CLIENT_SECRET,
    authority=f'https://login.microsoftonline.com/{TENANT_ID}'
)
token = app.acquire_token_for_client(scopes=['https://graph.microsoft.com/.default'])
if 'access_token' not in token:
    raise Exception(f"Erro ao autenticar no Graph: {token}")
access_token = token['access_token']

# 2. Listar arquivos XML na pasta do OneDrive
headers = {'Authorization': f'Bearer {access_token}'}
folder_url = f"https://graph.microsoft.com/v1.0/users/{USER_EMAIL}/drive/root:/{ONEDRIVE_FOLDER}:/children"
resp = requests.get(folder_url, headers=headers)
resp.raise_for_status()
arquivos = resp.json().get('value', [])

# 3. Baixar e processar cada XML
os.makedirs('baixados', exist_ok=True)
for arquivo in arquivos:
    if arquivo['name'].lower().endswith('.xml'):
        print(f"Baixando: {arquivo['name']}")
        download_url = arquivo['@microsoft.graph.downloadUrl']
        xml_content = requests.get(download_url).content
        # Salva localmente
        with open(f"baixados/{arquivo['name']}", 'wb') as f:
            f.write(xml_content)
        # TODO: Chame aqui sua função de importação para o Supabase
        # ex: importar_xml_para_supabase(xml_content)

print("Download dos XMLs do OneDrive concluído!")
