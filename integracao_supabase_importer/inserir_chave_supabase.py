from supabase import create_client, Client

SUPABASE_URL = 'SUA_SUPABASE_URL'
SUPABASE_KEY = 'SUA_SUPABASE_KEY'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def inserir_chave(chave_acesso):
    data = {"chave_acesso": chave_acesso}
    resp = supabase.table("nfs").insert(data).execute()
    print(resp)

if __name__ == "__main__":
    chave = input("Digite a chave de acesso (44 dígitos): ")
    inserir_chave(chave)
