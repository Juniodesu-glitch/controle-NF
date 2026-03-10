@echo off
setlocal
cd /d "%~dp0"
if "%NF_XML_DIR%"=="" set "NF_XML_DIR=C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app"
powershell -ExecutionPolicy Bypass -File "%~dp0nf-xml-server.ps1"
