@echo off
setlocal
cd /d "%~dp0"

REM Sobe o serviço XML em segundo plano
start "NF XML Server" powershell -ExecutionPolicy Bypass -File "%~dp0nf-xml-server.ps1"

REM Aguarda 1 segundo para o servidor iniciar
powershell -Command "Start-Sleep -Milliseconds 1000"

REM Abre o app (index.html) no navegador padrão
start "" "%~dp0index.html"
