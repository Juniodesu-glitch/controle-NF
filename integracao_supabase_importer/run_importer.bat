@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE=C:\tools\Anaconda3\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

if not exist .env (
  echo [ERRO] Arquivo .env nao encontrado.
  echo Copie .env.example para .env e preencha as chaves.
  exit /b 1
)

"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias.
  exit /b 1
)

"%PYTHON_EXE%" importer.py
