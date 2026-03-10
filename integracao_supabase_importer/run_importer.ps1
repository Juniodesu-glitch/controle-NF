$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if ([string]::IsNullOrWhiteSpace($env:NF_SOURCE_DIR)) {
    $env:NF_SOURCE_DIR = 'C:\Users\junio.gomes\Capricórnio Têxtil S.A\LOGISTICA - SERVIDOR DE ARQUIVOS - Documentos\nf-app'
}

# Evita herdar variáveis globais de execução única no Windows.
$env:RUN_ONCE = '0'
$env:FORCE_REIMPORT_ALL = '0'
$env:IMPORTER_FORCE_CONTINUOUS = '1'

# Mantém varredura frequente mesmo quando há POLL_SECONDS global no Windows.
if ([string]::IsNullOrWhiteSpace($env:POLL_SECONDS) -or $env:POLL_SECONDS -eq '20') {
    $env:POLL_SECONDS = '3'
}

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

function Test-PythonExecutable([string]$exePath) {
    if ([string]::IsNullOrWhiteSpace($exePath)) { return $false }
    if (-not (Test-Path $exePath)) { return $false }

    try {
        $null = & $exePath --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if (-not (Test-Path '.env')) {
    Write-ManagerLog 'ERRO: .env não encontrado. Copie .env.example para .env e configure as variáveis.'
    exit 1
}

Write-ManagerLog 'Iniciando monitor 24x7 do importer...'

$pythonExe = $env:PYTHON_EXE
if ([string]::IsNullOrWhiteSpace($pythonExe)) {
    $candidatos = @(
        (Join-Path $scriptDir '.venv\Scripts\python.exe'),
        (Join-Path $scriptDir 'venv\Scripts\python.exe'),
        'C:\Users\junio.gomes\PycharmProjects\PythonProject7\.venv\Scripts\python.exe',
        'C:\Users\junio.gomes\PycharmProjects\PythonProject10\.venv\Scripts\python.exe',
        'C:\tools\Anaconda3\python.exe'
    )

    $pythonExe = $null
    foreach ($candidato in $candidatos) {
        if (Test-PythonExecutable $candidato) {
            $pythonExe = $candidato
            break
        }
    }
}

if (-not (Test-PythonExecutable $pythonExe)) {
    $pythonExe = $null

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd -and (Test-PythonExecutable $pythonCmd.Source)) {
        $pythonExe = $pythonCmd.Source
    }

    if (-not $pythonExe) {
        $pyCmd = Get-Command py -ErrorAction SilentlyContinue
        if ($pyCmd) {
            try {
                $null = & $pyCmd.Source -3 --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $pythonExe = "$($pyCmd.Source) -3"
                }
            } catch {
                # segue para erro final
            }
        }
    }

    if (-not $pythonExe) {
        Write-ManagerLog 'ERRO: Python não encontrado. Defina PYTHON_EXE para o python.exe do PyCharm/.venv ou do Anaconda.'
        exit 1
    }
}

$pythonVersion = if ($pythonExe -like '* -3') {
    & $pyCmd.Source -3 --version 2>&1 | Select-Object -First 1
} else {
    & $pythonExe --version 2>&1 | Select-Object -First 1
}
Write-ManagerLog "Python selecionado: $pythonExe"
Write-ManagerLog "Versão detectada: $pythonVersion"

while ($true) {
    try {
        Write-ManagerLog 'Garantindo dependências Python...'
        if ($pythonExe -like '* -3') {
            & $pyCmd.Source -3 -m pip install -r requirements.txt | Out-Null
        } else {
            & $pythonExe -m pip install -r requirements.txt | Out-Null
        }

        Write-ManagerLog 'Iniciando importer.py...'
        if ($pythonExe -like '* -3') {
            $process = Start-Process -FilePath $pyCmd.Source -ArgumentList '-3', 'importer.py' -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru -NoNewWindow
        } else {
            $process = Start-Process -FilePath $pythonExe -ArgumentList 'importer.py' -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru -NoNewWindow
        }
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
