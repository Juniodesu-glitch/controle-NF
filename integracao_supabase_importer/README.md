# Integracao NF -> Supabase (Python)

Este modulo monitora uma pasta com NFs (`.xml` e `.pdf`) e grava no Supabase:
- `nfs`
- `nf_itens`
- `import_logs`

## 1. Configurar

1. Copie `.env.example` para `.env`.
2. Preencha:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NF_SOURCE_DIR`

## 2. Rodar no Windows

Execute:

`run_importer.bat`

Ele instala dependencias e inicia o monitoramento continuo.

Se voce usa PyCharm, pode apontar o Python da `.venv` sem usar conda:

`set PYTHON_EXE=C:\Users\SEU_USUARIO\PycharmProjects\SEU_PROJETO\.venv\Scripts\python.exe`

Depois rode `run_importer.bat` normalmente.

## 3. Como funciona

- Faz varredura recursiva na pasta `NF_SOURCE_DIR`.
- Detecta novos/alterados via `mtime` + `size`.
- Importa dados da NF e faz upsert em `nfs` por `numero_nf`.
- Substitui itens em `nf_itens`.
- Registra sucesso/erro em `import_logs`.

### Latencia de importacao

- Por padrao, o importador verifica arquivos novos a cada `5` segundos.
- Se precisar mais rapido, ajuste no `.env`:

`POLL_SECONDS=3`

## 4. Integracao com o app

Seu app ja foi ajustado para ler/escrever no Supabase.
Com este importador ativo, os dados das NFs entram no banco automaticamente,
e o app passa a consumir esses dados do banco.

## 5. Observacoes

- XML e o formato recomendado para extracao completa e confiavel.
- PDF usa regex e pode variar por layout.
- Para producao, execute este script como servico/tarefa agendada no servidor.

## 6. Modo 24x7 (Windows Server)

Arquivos incluidos:
- `run_importer.ps1`: gerenciador com auto-restart e logs.
- `install_24x7_task.ps1`: instala tarefa agendada no boot.
- `status_24x7_task.ps1`: mostra status da tarefa.
- `remove_24x7_task.ps1`: remove a tarefa.

### Instalar tarefa 24x7

No PowerShell (como administrador), dentro da pasta do importer:

`powershell -ExecutionPolicy Bypass -File .\install_24x7_task.ps1`

### Ver status

`powershell -ExecutionPolicy Bypass -File .\status_24x7_task.ps1`

### Logs

Logs ficam em:
- `logs/importer_stdout.log`
- `logs/importer_stderr.log`

### Remover tarefa

`powershell -ExecutionPolicy Bypass -File .\remove_24x7_task.ps1`
