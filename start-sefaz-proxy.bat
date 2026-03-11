@echo off
setlocal
cd /d "%~dp0"

if "%SEFAZ_PROXY_PORT%"=="" set "SEFAZ_PROXY_PORT=8790"
if "%SEFAZ_XML_API_URL%"=="" set "SEFAZ_XML_API_URL=http://127.0.0.1:%SEFAZ_PROXY_PORT%/sefaz/xml"
if "%SEFAZ_XML_API_METHOD%"=="" set "SEFAZ_XML_API_METHOD=POST"

powershell -ExecutionPolicy Bypass -File "%~dp0sefaz-proxy.ps1"
