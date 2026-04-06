Instalação e execução

Requisitos:
- Node.js >= 16

Variáveis de ambiente necessárias (para integração Supabase):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- (Opcional) IMPORT_API_KEY — chave para proteger o endpoint de importação

Executando localmente (servidor de NF XML e endpoints API):

1) Iniciar servidor local (usa `nf-xml-server.js` que expõe rotas em `/api`):

```bash
# no Windows PowerShell
node nf-xml-server.js
# ou via npm
npm start
```

2) Importar base CSV via frontend:
- Acesse o painel Admin → Relatórios → Base de NF
- Selecione um CSV e clique em "Importar base no Supabase"

3) Endpoints disponíveis localmente (via `nf-xml-server.js` e `/api`):
- `POST /api/import/nf-base` — importa uma base (payload: `{ rows: [...] }`)
- `GET  /api/import/nf-base?numero=...` — consulta nota por número

Notas de deploy
- Se for deploy no Vercel, adicione as variáveis de ambiente em Settings > Environment Variables.
- Após `git push` o Vercel vai rebuildar o projeto automaticamente.

Testes rápidos
```bash
# Consultar NF (exemplo)
curl "http://localhost:8787/api/import/nf-base?numero=12345"

# Importar base via curl (exemplo)
curl -X POST "http://localhost:8787/api/import/nf-base" -H "Content-Type: application/json" -d '{"rows":[{"numero":"12345","cliente":"Teste"}]}'
```
