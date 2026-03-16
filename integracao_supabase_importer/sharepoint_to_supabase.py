import os
import re
import xml.etree.ElementTree as ET
from supabase import create_client, Client

# Configurações
LOCAL_XML_FOLDER = r'C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app'
SUPABASE_URL = 'https://ttxobirrlaetnnnpalfk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eG9iaXJybGFldG5ubnBhbGZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkzNTY1OCwiZXhwIjoyMDg4NTExNjU4fQ.SvOxfGJcS1kaSlPwQKHhY7waZ4rXfnXdxJlpBTDQTXI'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_local_xml_files(folder_path):
    xml_files = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith('.xml'):
                xml_files.append(os.path.join(root, file))
    return xml_files

def read_xml_file(xml_path):
    with open(xml_path, 'r', encoding='utf-8') as f:
        return f.read()

def parse_xml(xml_content):
    root = ET.fromstring(xml_content)
    numero_nf = None
    cliente = None
    valor = None
    peso = None
    chave_acesso = None
    valores = []
    pesos = []
    for elem in root.iter():
        if elem.tag.endswith('textContent') and elem.text:
            # Chave de acesso: 44 dígitos
            if not chave_acesso:
                match = re.search(r'\b\d{44}\b', elem.text)
                if match:
                    chave_acesso = match.group(0)
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
        "peso": peso,
        "chave_acesso": chave_acesso
    }
def get_pending_chaves():
    # Busca todas as chaves de acesso que ainda não têm dados completos
    # Considera que existe a coluna 'chave_acesso' na tabela nfs
    result = supabase.table("nfs").select("chave_acesso, numero_nf").execute()
    chaves = []
    for row in result.data:
        if row.get("chave_acesso") and (not row.get("numero_nf") or row.get("numero_nf") == ""):
            chaves.append(row["chave_acesso"])
    return chaves
def update_nf_by_chave(chave_acesso, data):
    # Atualiza o registro da NF pela chave de acesso
    supabase.table("nfs").update(data).eq("chave_acesso", chave_acesso).execute()

def insert_nf_to_supabase(data):
    print(f"[INFO] Inserindo no Supabase: {data}")
    supabase.table("nfs").insert(data).execute()

def localizar_e_subir_nf_por_codigo_barras(codigo_barras):
    print("\n========== INÍCIO DO PROCESSO ==========")
    digits = re.sub(r'\D', '', codigo_barras)
    chave_acesso = None
    numero_nf = None
    # Extrai a chave de acesso (44 dígitos)
    if len(digits) == 44:
        chave_acesso = digits
    else:
        match = re.search(r'(\d{44})', digits)
        if match:
            chave_acesso = match.group(1)
    # Extrai o número da NF (6 dígitos) da posição padrão (posição 26 a 31, 0-based)
    if len(digits) >= 34:
        numero_nf = digits[25:31]
        print(f"[INFO] Número da NF extraído pela posição padrão: {numero_nf}")
    else:
        # fallback: busca qualquer sequência de 6 dígitos
        match_nf = re.search(r'(\d{6})', digits)
        if match_nf:
            numero_nf = match_nf.group(1)
            print(f"[INFO] Número da NF extraído por regex: {numero_nf}")
    if not numero_nf:
        print("[ERRO] Não foi possível extrair o número da NF do código de barras!")
        print("========== FIM ==========")
        return
    print(f"[INFO] Chave de acesso extraída: {chave_acesso if chave_acesso else 'Não encontrada'}")
    print(f"[INFO] Número da NF extraído: {numero_nf}")
    xml_files = get_local_xml_files(LOCAL_XML_FOLDER)
    encontrou = False
    for xml_path in xml_files:
        try:
            print(f"[LOG] Verificando arquivo: {xml_path}")
            xml_content = read_xml_file(xml_path)
            if numero_nf in xml_content:
                print(f"[SUCESSO] Encontrou o número da NF {numero_nf} no arquivo: {xml_path}")
                data = parse_xml(xml_content)
                data["numero_nf"] = numero_nf
                if chave_acesso:
                    data["chave_acesso"] = chave_acesso
                insert_nf_to_supabase(data)
                print(f"[OK] NF enviada ao Supabase: {data}")
                encontrou = True
                break
            elif chave_acesso and chave_acesso in xml_content:
                print(f"[SUCESSO] Encontrou a chave de acesso {chave_acesso} no arquivo: {xml_path}")
                data = parse_xml(xml_content)
                data["numero_nf"] = numero_nf
                data["chave_acesso"] = chave_acesso
                insert_nf_to_supabase(data)
                print(f"[OK] NF enviada ao Supabase: {data}")
                encontrou = True
                break
        except Exception as e:
            print(f"[ERRO] Falha ao processar {xml_path}: {e}")
    if not encontrou:
        print(f"[ERRO] Não foi encontrado XML correspondente para NF {numero_nf} ou chave {chave_acesso} na pasta!")
    print("========== FIM ==========")

if __name__ == "__main__":
    print("\n=== LEITOR DE NF POR CÓDIGO DE BARRAS ===")
    codigo_barras = input("Digite ou cole o código de barras/NF: ")
    localizar_e_subir_nf_por_codigo_barras(codigo_barras)

if __name__ == "__main__":
    main()
