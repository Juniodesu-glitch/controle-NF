@echo off
REM ============================================================
REM Start NF Importer - Dynamic Configuration
REM Carrega configurações de app-settings.json automaticamente
REM ============================================================
REM Este script inicia o importador Python com suporte a:
REM   - app-settings.json (configuração centralizada)
REM   - Variáveis de ambiente (.env)
REM   - Auto-descoberta de pasta NF
REM ============================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Cores para output (opcional)
cls
echo.
echo ====================================================
echo   NF-App Supabase Importer
echo   Modo: Continuous (aguardando novos XMLs)
echo ====================================================
echo.

REM Verificar se importer.py existe
if not exist "importer.py" (
    echo [ERRO] importer.py nao encontrado no diretorio!
    echo Certifique-se de estar na pasta integracao_supabase_importer/
    pause
    exit /b 1
)

REM Verificar se requirements.txt foi instalado
python -c "import supabase" 2>nul
if !errorlevel! neq 0 (
    echo [AVISO] Dependencias Python nao encontradas.
    echo Instalando requirements.txt...
    pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
)

REM Carregar variáveis de ambiente do .env (se existir)
if exist ".env" (
    for /f "delims== tokens=1,*" %%a in (.env) do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set "%%a=%%b"
        )
    )
    echo [OK] Variaveis de .env carregadas
)

REM Modo: continuous (padrão)
REM RUN_ONCE=0 significa que fica rodando indefinidamente
set "RUN_ONCE=0"
set "FORCE_REIMPORT_ALL=0"

echo.
echo [CONFIG] Iniciando importador...
echo   - RUN_ONCE: %RUN_ONCE%
echo   - FORCE_REIMPORT_ALL: %FORCE_REIMPORT_ALL%
if defined NF_SOURCE_DIR (
    echo   - NF_SOURCE_DIR: %NF_SOURCE_DIR%
) else (
    echo   - NF_SOURCE_DIR: sera auto-descoberto
)
echo.
echo [INFO] Aguardando novos XMLs...
echo [INFO] Pressione CTRL+C para parar
echo.

REM Executar importer com variáveis de ambiente
python importer.py

if !errorlevel! neq 0 (
    echo.
    echo [ERRO] Importer falhou com codigo: !errorlevel!
    echo Ver logs em: logs\importer.log
    pause
    exit /b !errorlevel!
)

pause
