#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste direto de extração de itens de um XML JasperPrint específico
"""

import sys
import os
from pathlib import Path

# Adiciona diretório do importador ao path
sys.path.insert(0, str(Path(__file__).parent / "integracao_supabase_importer"))

from parsers import parse_nf_file

# Caminho para o XML específico
xml_path = r"C:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_707594205.xml"

print("🔍 TESTANDO EXTRAÇÃO DE ITENS DO XML JASPERPRINT")
print("="*60)

if os.path.exists(xml_path):
    print(f"✅ Arquivo encontrado: {xml_path}")

    try:
        resultado = parse_nf_file(xml_path)

        print("\n📋 DADOS EXTRAÍDOS:")
        print("-"*60)
        print(f"Número NF: {resultado.get('numero_nf', 'N/A')}")
        print(f"Cliente: {resultado.get('cliente', 'N/A')}")
        print(f"Transportadora: {resultado.get('transportadora', 'N/A')}")
        print(f"Artigo: {resultado.get('artigo', 'N/A')}")
        print(f"Quantidade Pçs: {resultado.get('quantidade_itens', 0)}")
        print(f"Metros: {resultado.get('metros', 0)}")

        itens = resultado.get('itens', [])
        print(f"\n📦 ITENS ENCONTRADOS: {len(itens)}")
        print("-"*60)

        if itens:
            for i, item in enumerate(itens, 1):
                print(f"\nItem {i}:")
                print(f"  Descrição: {item.get('descricao', 'N/A')}")
                print(f"  Unidade: {item.get('unidade', 'N/A')}")
                print(f"  Quantidade: {item.get('quantidade', 0)}")
                print(f"  Valor Unitário: {item.get('valor_unitario', 0)}")
                print(f"  Valor Total: {item.get('valor_total', 0)}")
        else:
            print("❌ NENHUM ITEM FOI EXTRAÍDO!")
            print("\n🔧 POSSÍVEIS PROBLEMAS:")
            print("- Parser não encontrou seção 'DESCRIÇÃO DOS PRODUTOS'")
            print("- Produtos não seguem padrão esperado")
            print("- XML pode ter estrutura diferente")

    except Exception as e:
        print(f"❌ ERRO AO PROCESSAR: {e}")
        import traceback
        traceback.print_exc()

else:
    print(f"❌ Arquivo NÃO encontrado: {xml_path}")
    print("\nVerifique se o XML foi copiado para a pasta correta!")

print("\n" + "="*60)