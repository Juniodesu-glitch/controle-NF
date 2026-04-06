from integracao_supabase_importer.parsers import parse_danfe_jasperprint_xml
paths = [
    r"c:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_707594205.xml",
    r"c:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_712907987.xml",
    r"c:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_726035440.xml",
    r"c:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_845072546.xml",
    r"c:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\nf--app2.0\danfe_976767095.xml",
]
for p in paths:
    print('---', p)
    import os
    print('exists', os.path.exists(p))
    if not os.path.exists(p):
        continue
    try:
        parsed = parse_danfe_jasperprint_xml(p)
        print('numero_nf', parsed.get('numero_nf'), 'artigo', parsed.get('artigo'), 'itens', len(parsed.get('itens', [])), 'quantidade', parsed.get('quantidade_itens'), 'metros', parsed.get('metros'))
        for i, item in enumerate(parsed.get('itens', [])[:6]):
            print('  ', i+1, item)
    except Exception as e:
        print('ERROR', type(e).__name__, e)
