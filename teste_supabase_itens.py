import os
import sys
sys.path.append(os.path.dirname(__file__))

from integracao_supabase_importer.supabase_client import get_supabase_client

def verificar_itens_supabase():
    try:
        supabase = get_supabase_client()

        # Buscar todas as NFs
        nfs = supabase.table('nfs').select('*').execute()
        print(f"Total de NFs: {len(nfs.data)}")

        # Buscar todos os itens
        itens = supabase.table('nf_itens').select('*').execute()
        print(f"Total de itens: {len(itens.data)}")

        # Mostrar alguns exemplos
        if itens.data:
            print("\nPrimeiros 5 itens:")
            for i, item in enumerate(itens.data[:5]):
                print(f"  Item {i+1}: NF_ID={item.get('nf_id')}, Descrição='{item.get('descricao', '')[:50]}...', Qtd={item.get('quantidade')}")

        # Verificar distribuição por NF
        nf_ids = {}
        for item in itens.data:
            nf_id = item.get('nf_id')
            if nf_id not in nf_ids:
                nf_ids[nf_id] = 0
            nf_ids[nf_id] += 1

        print(f"\nDistribuição de itens por NF:")
        for nf_id, count in sorted(nf_ids.items()):
            print(f"  NF {nf_id}: {count} itens")

    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    verificar_itens_supabase()