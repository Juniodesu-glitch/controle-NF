$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$logDir = Join-Path $scriptDir 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$stdoutLog = Join-Path $logDir 'importer_stdout.log'
$stderrLog = Join-Path $logDir 'importer_stderr.log'

function Write-ManagerLog([string]$message) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] $message"
    Add-Content -Path $stdoutLog -Value $line
    Write-Host $line
}

if (-not (Test-Path '.env')) {
    Write-ManagerLog 'ERRO: .env não encontrado. Copie .env.example para .env e configure as variáveis.'
    exit 1
}

Write-ManagerLog 'Iniciando monitor 24x7 do importer...'

$pythonExe = 'C:\tools\Anaconda3\python.exe'
if (-not (Test-Path $pythonExe)) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $pythonExe = $pythonCmd.Source
    } else {
        Write-ManagerLog 'ERRO: Python não encontrado. Verifique C:\tools\Anaconda3\python.exe ou adicione python ao PATH.'
        exit 1
    }
}

$pythonVersion = (& $pythonExe --version 2>&1 | Select-Object -First 1)
Write-ManagerLog "Python selecionado: $pythonExe"
Write-ManagerLog "Versão detectada: $pythonVersion"

while ($true) {
    try {
        Write-ManagerLog 'Garantindo dependências Python...'
        & $pythonExe -m pip install -r requirements.txt | Out-Null

        Write-ManagerLog 'Iniciando importer.py...'
        $process = Start-Process -FilePath $pythonExe -ArgumentList 'importer.py' -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru -NoNewWindow
        $process.WaitForExit()

        $exitCode = $process.ExitCode
        Write-ManagerLog "importer.py finalizou com código $exitCode. Reiniciando em 5 segundos..."
        Start-Sleep -Seconds 5
    }
    catch {
        Write-ManagerLog "Falha no gerenciador 24x7: $($_.Exception.Message). Tentando novamente em 10 segundos..."
        Start-Sleep -Seconds 10
    }
}
