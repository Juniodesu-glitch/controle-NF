#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verifica dados importados no Supabase
Mostra quais NFs têm dados preenchidos e quais têm zerado
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent / "integracao_supabase_importer"))

load_dotenv()

from supabase_client import SupabaseClient

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not SUPABASE_URL or not SERVICE_KEY:
    print("Erro: Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

client = SupabaseClient(SUPABASE_URL, SERVICE_KEY)

print("\n" + "="*100)
print("VERIFICACAO DE DADOS IMPORTADOS NO SUPABASE")
print("="*100 + "\n")

try:
    result = client.request("GET", "nfs", params={
        "select": "id,numero_nf,artigo,quantidade_itens,metros,valor_total,origem_xml,origem_tipo",
        "order": "numero_nf.asc"
    })
    
    if not isinstance(result, list):
        print(f"Erro ao consultar: {result}")
        sys.exit(1)
    
    if not result:
        print("Nenhuma NF foi importada!")
        sys.exit(0)
    
    print(f"Total de NFs no banco: {len(result)}\n")
    
    print("Estado dos dados:")
    print("-"*100)
    print(f"{'NF':<15} {'ARTIGO':<30} {'PCS':<10} {'METROS':<12} {'VALOR':<15} {'TIPO':<12} {'STATUS'}")
    print("-"*100)
    
    zerados = []
    preenchidos = []
    
    for nf in result:
        numero = str(nf.get("numero_nf", "")).ljust(15)
        artigo = str(nf.get("artigo", "-"))[:30].ljust(30)
        pcs = str(nf.get("quantidade_itens", 0)).ljust(10)
        metros = str(nf.get("metros", 0)).ljust(12)
        valor = str(nf.get("valor_total", 0)).ljust(15)
        tipo = str(nf.get("origem_tipo", "")).ljust(12)
        
        status = "✓" if (float(nf.get("quantidade_itens", 0)) > 0 or float(nf.get("metros", 0)) > 0) else "❌"
        
        print(f"{numero} {artigo} {pcs} {metros} {valor} {tipo} {status}")
        
        if float(nf.get("quantidade_itens", 0)) == 0 and float(nf.get("metros", 0)) == 0:
            zerados.append({
                "numero": nf.get("numero_nf"),
                "tipo": nf.get("origem_tipo"),
                "artigo": nf.get("artigo")
            })
        else:
            preenchidos.append(nf.get("numero_nf"))
    
    print("-"*100)
    print(f"\nResumo: {len(preenchidos)} NFs com dados | {len(zerados)} NFs zeradas\n")
    
    if zerados:
        print("NFs COM PROBLEMA (zeradas):")
        for nf in zerados:
            print(f"  • NF {nf['numero']:.<15} ({nf['tipo']}) - Artigo: {nf['artigo']}")
        
        print("\nPossíveis causas:")
        print("  1. XML do JasperPrint não tem campos QUANT/QUANTIDADE diferenciado de METROS")
        print("  2. Parser não conseguiu extrair valores dos rótulos esperados")
        print("  3. Arquivo XML foi corrompido ou está incompleto")
    
    if preenchidos:
        print(f"\nNFs importadas com SUCESso (com dados): {', '.join(str(n) for n in preenchidos)}")
        
except Exception as e:
    print(f"Erro ao conectar ao Supabase: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*100 + "\n")
