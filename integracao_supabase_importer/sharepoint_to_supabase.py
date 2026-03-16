import os
import requests
import xml.etree.ElementTree as ET
from supabase import create_client, Client

# Configurações
LOCAL_XML_FOLDER = r'C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app'
SUPABASE_URL = 'https://ttxobirrlaetnnnpalfk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eG9iaXJybGFldG5ubnBhbGZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkzNTY1OCwiZXhwIjoyMDg4NTExNjU4fQ.SvOxfGJcS1kaSlPwQKHhY7waZ4rXfnXdxJlpBTDQTXI'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_local_xml_files(folder_path):
    print(f"[INFO] Buscando arquivos XML na pasta local: {folder_path}")
    xml_files = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith('.xml'):
                xml_files.append(os.path.join(root, file))
    print(f"[INFO] {len(xml_files)} arquivos XML encontrados.")
    for f in xml_files:
        print(f"[XML] {f}")
    return xml_files

def read_xml_file(xml_path):
    print(f"[INFO] Lendo XML: {xml_path}")
    with open(xml_path, 'r', encoding='utf-8') as f:
        return f.read()

def parse_xml(xml_content):
    import re
    root = ET.fromstring(xml_content)
    numero_nf = None
    # Busca todos os textContent
    for elem in root.iter():
        if elem.tag.endswith('textContent') and elem.text:
            # Procura por número de 6 dígitos (ex: 401327)
            match = re.search(r'\b\d{6}\b', elem.text)
            if match:
                numero_nf = match.group(0)
                break
    # CNPJ e valor não são extraídos desse XML DANFE
    cnpj = None
    valor = None
    # O campo do Supabase deve ser exatamente 'numero_nf'
    return {"numero_nf": numero_nf}

def insert_nf_to_supabase(data):
    print(f"[INFO] Inserindo no Supabase: {data}")
    supabase.table("nfs").insert(data).execute()

def main():
    xml_files = get_local_xml_files(LOCAL_XML_FOLDER)
    if not xml_files:
        print("[WARN] Nenhum arquivo XML encontrado na pasta local.")
    for xml_path in xml_files:
        try:
            xml_content = read_xml_file(xml_path)
            data = parse_xml(xml_content)
            insert_nf_to_supabase(data)
        except Exception as e:
            print(f"[ERRO] Falha ao processar {xml_path}: {e}")

if __name__ == "__main__":
    main()
