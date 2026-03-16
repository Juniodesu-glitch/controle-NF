import os
import requests
import xml.etree.ElementTree as ET
from supabase import create_client, Client

SHAREPOINT_SITE = os.getenv('SHAREPOINT_SITE')  # Ex: capricornio.sharepoint.com
SHAREPOINT_DRIVE_ID = os.getenv('SHAREPOINT_DRIVE_ID')  # ID do drive
SHAREPOINT_FOLDER_ID = os.getenv('SHAREPOINT_FOLDER_ID')  # ID da pasta
SHAREPOINT_TOKEN = os.getenv('SHAREPOINT_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Inicializa Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_sharepoint_xml_files(site, drive_id, folder_id, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site}/drives/{drive_id}/items/{folder_id}/children"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    files = response.json().get('value', [])
    xml_files = [f for f in files if f['name'].endswith('.xml')]
    return xml_files

def download_sharepoint_file(site, drive_id, file_id, token):
    url = f"https://graph.microsoft.com/v1.0/sites/{site}/drives/{drive_id}/items/{file_id}/content"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.content

def parse_xml(xml_content):
    root = ET.fromstring(xml_content)
    # Exemplo: extrair CNPJ e valor
    cnpj = root.find('.//CNPJ').text if root.find('.//CNPJ') is not None else None
    valor = root.find('.//vNF').text if root.find('.//vNF') is not None else None
    return {"cnpj": cnpj, "valor": valor}

def insert_nf_to_supabase(data):
    supabase.table("nfs").insert(data).execute()

def main():
    xml_files = get_sharepoint_xml_files(SHAREPOINT_SITE, SHAREPOINT_DRIVE_ID, SHAREPOINT_FOLDER_ID, SHAREPOINT_TOKEN)
    for file in xml_files:
        xml_content = download_sharepoint_file(SHAREPOINT_SITE, SHAREPOINT_DRIVE_ID, file['id'], SHAREPOINT_TOKEN)
        data = parse_xml(xml_content)
        insert_nf_to_supabase(data)

if __name__ == "__main__":
    main()
