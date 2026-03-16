import os
import requests
import xml.etree.ElementTree as ET
from supabase import create_client, Client

# Configurações
SHAREPOINT_FOLDER_URL = 'https://ttxobirrlaetnnnpalfk.supabase.co'  # Link compartilhado da pasta
SUPABASE_URL = 'https://ttxobirrlaetnnnpalfk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eG9iaXJybGFldG5ubnBhbGZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkzNTY1OCwiZXhwIjoyMDg4NTExNjU4fQ.SvOxfGJcS1kaSlPwQKHhY7waZ4rXfnXdxJlpBTDQTXI'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_sharepoint_xml_files(folder_url):
    print(f"[INFO] Buscando arquivos XML na pasta: {folder_url}")
    response = requests.get(folder_url)
    response.raise_for_status()
    xml_links = []
    for line in response.text.splitlines():
        if '.xml' in line and 'href' in line:
            start = line.find('href="') + 6
            end = line.find('.xml', start) + 4
            link = line[start:end]
            if link.startswith('http'):
                xml_links.append(link)
    print(f"[INFO] {len(xml_links)} arquivos XML encontrados.")
    for l in xml_links:
        print(f"[XML] {l}")
    return xml_links

def download_xml_file(xml_url):
    print(f"[INFO] Baixando XML: {xml_url}")
    response = requests.get(xml_url)
    response.raise_for_status()
    return response.content

def parse_xml(xml_content):
    root = ET.fromstring(xml_content)
    cnpj = root.find('.//CNPJ').text if root.find('.//CNPJ') is not None else None
    valor = root.find('.//vNF').text if root.find('.//vNF') is not None else None
    return {"cnpj": cnpj, "valor": valor}

def insert_nf_to_supabase(data):
    print(f"[INFO] Inserindo no Supabase: {data}")
    supabase.table("nfs").insert(data).execute()

def main():
    xml_links = get_sharepoint_xml_files(SHAREPOINT_FOLDER_URL)
    if not xml_links:
        print("[WARN] Nenhum arquivo XML encontrado na pasta do SharePoint.")
    for xml_url in xml_links:
        try:
            xml_content = download_xml_file(xml_url)
            data = parse_xml(xml_content)
            insert_nf_to_supabase(data)
        except Exception as e:
            print(f"[ERRO] Falha ao processar {xml_url}: {e}")

if __name__ == "__main__":
    main()
