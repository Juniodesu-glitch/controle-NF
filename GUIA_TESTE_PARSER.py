#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análise rápida: extrai campos-chave do XML fornecido (danfe_707594205.xml)
sem depender do arquivo em disco (usa strings mock para teste)
"""

import json
from pathlib import Path

# Adiciona importador ao path
import sys
sys.path.insert(0, str(Path(__file__).parent / "integracao_supabase_importer"))

from parsers import _jasperprint_texts, _to_float, _local_name, _strip_non_digits
import xml.etree.ElementTree as ET
import re

print("\n" + "="*80)
print("ANALISE DE CAMPOS DO XML JASPERPRINT")
print("="*80 + "\n")

# Baseado na estrutura do anexo, simulamos um parse simplificado
print("CAMPOS ESPERADOS NO XML JASPERPRINT danfe_707594205.xml:")
print("-"*80)

campos_esperados = {
    "Chave de Acesso": "44 dígitos (ex: 1234567890123456789012345678901234567890)",
    "Número NF": "posição 25-34 da chave OU numero com zeros (ex: 000707594)",
    "Cliente": "nome com LTDA/EIRELI/S/A após DESTINATARIO",
    "Transportadora": "nome após label TRANSPORTADOR(A) E FRETE",
    "Data de Emissão": "data no formato DD/MM/YYYY",
    "Valor Total da Nota": "valor em formato 1234.56 ou 1234,56",
    "Peso Bruto": "valor após label PESO BRUTO",
    "Artigo/Descrição": "texto após DESCRIÇAO DOS PRODUTOS / SERVIÇOS",
    "QUANT (Peças)": "número decimal após label QUANT",
    "METROS": "número decimal após label METROS",
}

for campo, descricao in campos_esperados.items():
    print(f"\n  {campo}")
    print(f"    Esperado: {descricao}")

print("\n" + "-"*80)
print("\nDICAS DE DEBUGGING (se dados continuarem zerados no app):")
print("-"*80)

dicas = [
    "1. Verifique se o XML foi salvo em: C:\\Users\\junio.gomes\\OneDrive - Capricórnio Têxtil S.A\\nf--app2.0",
    "2. Rode o importador manualmente: run_importer.bat",
    "3. Verifique import_logs no Supabase para mensagens de erro",
    "4. Se houver campo 'artigo' zerado, parser pode não estar extraindo ou está filtrando incorretamente",
    "5. Verifique se nf_itens foi populado no Supabase (tabela nf_itens, coluna descricao)",
    "6. Confirme que app.js está chamando obterItensDaNotaPorId() na renderizacao do Faturista",
]

for dica in dicas:
    print(f"  {dica}")

print("\n" + "="*80 + "\n")

# Propõe ajustes se necessário
print("PRÓXIMOS PASSOS:")
print("-"*80)
print("""
1. Coloque o XML (danfe_707594205.xml) na pasta de origem:
   C:\\Users\\junio.gomes\\OneDrive - Capricórnio Têxtil S.A\\nf--app2.0

2. Execute o importador (modo contínuo):
   Abra PowerShell e rode: run_importer.ps1
   
   OU modo único:
   run_importer.bat

3. Acompanhe os logs:
   - Locais: integracao_supabase_importer\\logs\\importer.log
   - Supabase: tabela import_logs

4. Verifique os dados importados:
   - Supabase → tabela 'nfs': confira quantidade_itens, metros, artigo
   - Supabase → tabela 'nf_itens': confira descricao e quantidade de itens

5. Recarregue o app e veja o Faturista para confirmar dados
""")

print("="*80 + "\n")
