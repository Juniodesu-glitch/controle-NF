@echo off
setlocal
cd /d "%~dp0"
if "%NF_SOURCE_DIR%"=="" set "NF_SOURCE_DIR=C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app"

if "%PYTHON_EXE%"=="" (
  if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
  ) else if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
  ) else if exist "C:\tools\Anaconda3\python.exe" (
    set "PYTHON_EXE=C:\tools\Anaconda3\python.exe"
  ) else (
    set "PYTHON_EXE=python"
  )
)

if not exist .env (
  echo [ERRO] Arquivo .env nao encontrado.
  echo Copie .env.example para .env e preencha as chaves.
  exit /b 1
)

"%PYTHON_EXE%" --version >nul 2>nul
if errorlevel 1 (
  py --version >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo [DICA] Defina PYTHON_EXE para o python.exe do PyCharm/.venv.
    exit /b 1
  )
  set "PYTHON_EXE=py"
)

if /i "%PYTHON_EXE%"=="py" (
  py -3 -m pip install -r requirements.txt
) else (
  "%PYTHON_EXE%" -m pip install -r requirements.txt
)
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias.
  echo [DICA] Defina PYTHON_EXE com o caminho completo do Python. Exemplo:
  echo        set PYTHON_EXE=C:\Users\SEU_USUARIO\PycharmProjects\SEU_PROJETO\.venv\Scripts\python.exe
  exit /b 1
)

if /i "%PYTHON_EXE%"=="py" (
  py -3 importer.py
) else (
  "%PYTHON_EXE%" importer.py
)
