@echo off
chcp 65001 > nul
cd /d "C:\Users\junio.gomes\OneDrive - Capricórnio Têxtil S.A\Desktop\Controle de Expedição\Aplicativo com Login e Controles para Admin e Usuários\Controle-NF"
"C:\tools\Anaconda3\python.exe" verificar_dados_importados.py > verificacao_resultado.txt 2>&1
pause
