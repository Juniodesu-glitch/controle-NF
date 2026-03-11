@echo off
setlocal
cd /d "%~dp0"

REM =========================================
REM  Inicia o aplicativo via servidor HTTP
REM  (resolve problemas de CORS com file://)
REM =========================================

REM Detecta Python (Anaconda, py launcher ou python no PATH)
set "PYTHON_EXE="
if exist "C:\tools\Anaconda3\python.exe" (
    set "PYTHON_EXE=C:\tools\Anaconda3\python.exe"
) else (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_EXE=py"
    ) else (
        where python >nul 2>&1
        if not errorlevel 1 (
            set "PYTHON_EXE=python"
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo ERRO: Python nao encontrado. Instale o Python ou Anaconda.
    pause
    exit /b 1
)

REM Mata processos antigos do servidor local (porta 5500)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5500 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

REM Inicia servidor HTTP local em segundo plano
start "Servidor Local NF" /min %PYTHON_EXE% "%~dp0servidor_local.py"

REM Aguarda o servidor subir
powershell -Command "Start-Sleep -Milliseconds 1500"

REM Abre o app no navegador via HTTP (nao mais via file://)
start "" "http://127.0.0.1:5500/index.html"
