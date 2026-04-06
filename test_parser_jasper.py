#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste de parser para XML JasperPrint (danfe_707594205.xml)
Valida extraçao de: número NF, artigos, PCS, METROS, cliente, transportadora, etc.
"""

import sys
import json
import io
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Adiciona diretório do importador ao path
sys.path.insert(0, str(Path(__file__).parent / "integracao_supabase_importer"))

from parsers import parse_nf_file, _jasperprint_texts

# Localiza o arquivo de teste
xml_path = Path(__file__).parent / "danfe_707594205.xml"

if not xml_path.exists():
    print(f"❌ Arquivo não encontrado: {xml_path}")
    sys.exit(1)

print(f"📄 Testando parser com: {xml_path.name}\n")
print("=" * 80)

try:
    # Testa parse
    resultado = parse_nf_file(str(xml_path))
    
    print("✅ PARSE EXECUTADO COM SUCESSO\n")
    print("Campos extraídos:")
    print("─" * 80)
    
    campos_principais = [
        ("Número NF", resultado.get("numero_nf")),
        ("Chave de Acesso", resultado.get("chave_acesso")),
        ("Série", resultado.get("serie")),
        ("Cliente", resultado.get("cliente")),
        ("Transportadora", resultado.get("transportadora")),
        ("Artigo/Descrição", resultado.get("artigo")),
        ("Quantidade de Itens (PÇS)", resultado.get("quantidade_itens")),
        ("Metros", resultado.get("metros")),
        ("Peso Bruto", resultado.get("peso_bruto")),
        ("Valor Total", resultado.get("valor_total")),
        ("Data de Emissão", resultado.get("data_emissao")),
        ("Pedido", resultado.get("pedido")),
        ("Status", resultado.get("status")),
        ("Tipo de Origem", resultado.get("origem_tipo")),
    ]
    
    for nome, valor in campos_principais:
        valor_exibido = str(valor) if valor is not None else "⚠️  (vazio)"
        print(f"  {nome:.<35} {valor_exibido}")
    
    print("\n" + "─" * 80)
    print(f"Total de itens capturados: {len(resultado.get('itens', []))}\n")
    
    if resultado.get("itens"):
        print("Itens da NF:")
        print("─" * 80)
        for idx, item in enumerate(resultado["itens"], 1):
            print(f"\n  Item {idx}:")
            print(f"    Código............. {item.get('codigo', '-')}")
            print(f"    Descrição.......... {item.get('descricao', '-')}")
            print(f"    Unidade............ {item.get('unidade', '-')}")
            print(f"    Quantidade......... {item.get('quantidade', 0)}")
            print(f"    Valor Unitário..... {item.get('valor_unitario', 0)}")
            print(f"    Valor Total........ {item.get('valor_total', 0)}")
    
    print("\n" + "=" * 80)
    print("\n📊 JSON COMPLETO (para debug avançado):\n")
    print(json.dumps(resultado, indent=2, default=str))
    
except Exception as e:
    print(f"❌ ERRO AO PARSEAR: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)
