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
    cliente = None
    valor = None
    peso = None
    # Heurísticas para extração
    valores = []
    pesos = []
    for elem in root.iter():
        if elem.tag.endswith('textContent') and elem.text:
            # Número da NF: 6 dígitos
            if not numero_nf:
                match = re.search(r'\b\d{6}\b', elem.text)
                if match:
                    numero_nf = match.group(0)
            # Cliente: primeira string toda maiúscula (exceto DANFE, NF-e, etc)
            if not cliente:
                if elem.text.isupper() and len(elem.text) > 5 and 'DANFE' not in elem.text and 'NF' not in elem.text:
                    cliente = elem.text.strip()
            # Valor: maior número com vírgula
            valor_match = re.findall(r'\d{1,3}(?:\.\d{3})*,\d{2}', elem.text)
            for v in valor_match:
                valores.append(float(v.replace('.', '').replace(',', '.')))
            # Peso: maior número com ponto
            peso_match = re.findall(r'\d{1,3}(?:\.\d{3})*\.\d{2}', elem.text)
            for p in peso_match:
                pesos.append(float(p.replace('.', '')))
    if valores:
        valor = max(valores)
    if pesos:
        peso = max(pesos)
    return {
        "numero_nf": numero_nf,
        "cliente": cliente,
        "valor": valor,
        "peso": peso
    }

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
