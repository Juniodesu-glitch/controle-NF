from integracao_supabase_importer.parsers import _is_jasperprint_xml, parse_danfe_jasperprint_xml
import xml.etree.ElementTree as ET

print('loaded')
root = ET.fromstring('<jasperPrint></jasperPrint>')
print('_is_jasperprint_xml', _is_jasperprint_xml(root))
