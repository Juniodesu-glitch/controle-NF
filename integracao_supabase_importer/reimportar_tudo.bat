@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   REIMPORT COMPLETO - Reprocessa todos os XMLs/PDFs
echo   Popula a coluna xml_conteudo no Supabase
echo ============================================================
echo.

set "RUN_ONCE=1"
set "FORCE_REIMPORT_ALL=1"
set "IMPORTER_FORCE_CONTINUOUS=0"
if "%NF_SOURCE_DIR%"=="" set "NF_SOURCE_DIR=C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app"

if "%PYTHON_EXE%"=="" (
  if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
  ) else if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
  ) else if exist "C:\tools\Anaconda3\python.exe" (
    set "PYTHON_EXE=C:\tools\Anaconda3\python.exe"
  ) else (
    py --version >nul 2>nul
    if not errorlevel 1 (
      set "PYTHON_EXE=py"
    ) else (
      set "PYTHON_EXE=python"
    )
  )
)

if not exist .env (
  echo [ERRO] Arquivo .env nao encontrado.
  exit /b 1
)

echo Iniciando reimport completo...
echo.
"%PYTHON_EXE%" importer.py

echo.
echo ============================================================
echo   Reimport finalizado!
echo   Todas as NFs agora possuem xml_conteudo no Supabase.
echo ============================================================
pause
