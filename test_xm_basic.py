#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inspeciona estrutura básica do XML JasperPrint
"""

import xml.etree.ElementTree as ET
import sys

# XML path - será criado do zero para teste
xml_content = """<?xml version="1.0" encoding="UTF-8"?>
<jasperPrint xmlns="http://jasperreports.sourceforge.net/jasperreports/print">
  <page>
    <text>0001 0002 0000 0000 0000 0000 0000 0000 0000 0000 0000 0001 2345 6789</text>
    <text>400200</text>
    <text>Capricornio</text>
    <text>20/03/2026</text>
    <text>QUANT</text>
    <text>120.50</text>
    <text>METROS</text>
    <text>250.75</text>
    <text>Tecido para camiseta</text>
  </page>
</jasperPrint>"""

# Parse teste
try:
    root = ET.fromstring(xml_content)
    print("XML parsed with success")
    print("\nTexts found:")
    for i, elem in enumerate(root.iter()):
        if 'text' in elem.tag.lower():
            print(f"  Text {i}: {elem.text}")
except Exception as e:
    print(f"Error: {e}")
