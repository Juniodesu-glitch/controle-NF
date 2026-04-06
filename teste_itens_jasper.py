#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste específico para extração de múltiplos itens do JasperPrint XML
"""

import sys
import json
from pathlib import Path

# Adiciona diretório do importador ao path
sys.path.insert(0, str(Path(__file__).parent / "integracao_supabase_importer"))

from parsers import parse_nf_file

# Caminho para um XML JasperPrint (se existir)
xml_path = Path(__file__).parent / "danfe_707594205.xml"

print("\n" + "="*80)
print("TESTE DE EXTRAÇÃO DE MÚLTIPLOS ITENS - JASPERPRINT")
print("="*80 + "\n")

if xml_path.exists():
    print(f"📄 Testando com arquivo real: {xml_path.name}")
    
    try:
        resultado = parse_nf_file(str(xml_path))
        
        print("✅ PARSE EXECUTADO COM SUCESSO\n")
        
        print("ITENS EXTRAÍDOS:")
        print("-"*80)
        
        itens = resultado.get("itens", [])
        if itens:
            for idx, item in enumerate(itens, 1):
                print(f"\n  Item {idx}:")
                print(f"    Descrição: {item.get('descricao', '-')}")
                print(f"    Unidade: {item.get('unidade', '-')}")
                print(f"    Quantidade: {item.get('quantidade', 0)}")
                print(f"    Valor Unitário: {item.get('valor_unitario', 0)}")
                print(f"    Valor Total: {item.get('valor_total', 0)}")
            
            print(f"\n📊 Total de itens encontrados: {len(itens)}")
        else:
            print("❌ Nenhum item foi extraído!")
        
        print("\n" + "-"*80)
        print("RESUMO DA NF:")
        print(f"  Número: {resultado.get('numero_nf', '-')}")
        print(f"  Cliente: {resultado.get('cliente', '-')}")
        print(f"  Artigo: {resultado.get('artigo', '-')}")
        print(f"  Quantidade Total: {resultado.get('quantidade_itens', 0)}")
        print(f"  Metros Total: {resultado.get('metros', 0)}")
        
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()

else:
    print("❌ Arquivo de teste não encontrado. Criando simulação...")
    
    # Simulação de dados JasperPrint
    print("\nSimulação de extração de itens:")
    print("-"*80)
    
    # Simula o que o parser faria
    textos_simulados = [
        "DANFE",
        "CHAVE DE ACESSO",
        "1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234",
        "Nº 000707594",
        "20/03/2026",
        "DESTINATÁRIO/REMETENTE",
        "EMPRESA EXEMPLO LTDA",
        "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS",
        "TECIDO PARA CAMISETA ALGODÃO",
        "TECIDO PARA CALÇA JEANS",
        "TECIDO PARA BLUSA LINHO",
        "QUANT",
        "150.00",
        "METROS",
        "250.75",
        "VALOR TOTAL DA NOTA",
        "1250.00",
        "DADOS ADICIONAIS"
    ]
    
    print("Textos simulados do JasperPrint:")
    for i, t in enumerate(textos_simulados, 1):
        print(f"  {i:2d}: {t}")
    
    print("\nItens que seriam extraídos:")
    produtos_encontrados = []
    for t in textos_simulados:
        if ("TECIDO" in t.upper() and len(t) > 10):
            produtos_encontrados.append(t)
    
    for idx, produto in enumerate(produtos_encontrados, 1):
        print(f"\n  Item {idx}:")
        print(f"    Descrição: {produto}")
        print("    Unidade: un (seria ajustado para 'm' se metros > 0)"
        print("    Quantidade: 0.0 (seria calculado)"
    
    print(f"\n📊 Total de itens simulados: {len(produtos_encontrados)}")

print("\n" + "="*80)
print("PRÓXIMOS PASSOS:")
print("-"*80)
print("""
1. Execute o importador para processar XMLs existentes:
   cd integracao_supabase_importer
   python importer.py

2. Verifique no Supabase se nf_itens foi populada com múltiplos registros

3. Recarregue o app e veja se os itens aparecem no Faturista

4. Para novos XMLs, o parser agora extrairá automaticamente múltiplos itens
""")
print("="*80 + "\n")