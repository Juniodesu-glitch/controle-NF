@echo off
setlocal
cd /d "%~dp0"

if "%PYTHON_EXE%"=="" set "PYTHON_EXE=python"
if /i "%PYTHON_EXE%"=="python" (
  if exist "C:\tools\Anaconda3\python.exe" set "PYTHON_EXE=C:\tools\Anaconda3\python.exe"
)

if not exist .env (
  echo [ERRO] Arquivo .env nao encontrado.
  echo Copie .env.example para .env e preencha as chaves.
  exit /b 1
)

"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias.
  echo [DICA] Defina PYTHON_EXE com o caminho completo do Python. Exemplo:
  echo        set PYTHON_EXE=C:\Python311\python.exe
  exit /b 1
)

"%PYTHON_EXE%" importer.py
