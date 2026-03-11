#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$taskName = 'NF-Importer-24x7'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $scriptDir 'run_importer.ps1'

if (-not (Test-Path $runnerPath)) {
    throw "run_importer.ps1 nao encontrado em: $runnerPath"
}

# --- Acao: powershell.exe executando run_importer.ps1 ---
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runnerPath`"" `
    -WorkingDirectory $scriptDir

# --- Triggers: boot + logon + diario (safety net) ---
$triggerBoot   = New-ScheduledTaskTrigger -AtStartup
$triggerLogon  = New-ScheduledTaskTrigger -AtLogOn
$triggerDaily  = New-ScheduledTaskTrigger -Daily -At '06:00'

# Adiciona repeticao a cada 5 min por tempo indefinido nos triggers de seguranca
foreach ($t in @($triggerDaily)) {
    $t.Repetition.Interval = 'PT5M'
    $t.Repetition.StopAtDurationEnd = $false
}

# --- Principal: roda com a conta do usuario, mesmo sem logon interativo ---
Write-Host ''
Write-Host '=== Configuracao da Tarefa Agendada NF-Importer-24x7 ==='
Write-Host ''
Write-Host "Usuario: $env:USERDOMAIN\$env:USERNAME"
Write-Host 'A tarefa rodara mesmo quando voce NAO estiver logado.'
Write-Host 'Informe sua senha do Windows para registrar a tarefa:'
Write-Host ''
$cred = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message 'Senha para a tarefa NF-Importer-24x7'

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Password `
    -RunLevel Highest

# --- Settings: nunca parar, reiniciar sempre ---
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -DontStopOnIdleEnd `
    -RestartCount 9999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# --- Registrar ---
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger @($triggerBoot, $triggerLogon, $triggerDaily) `
    -Principal $principal `
    -Settings $settings `
    -Description 'Importador NF XML/PDF para Supabase rodando 24x7 - auto-start no boot, reinicia em caso de falha' `
    -Password $cred.GetNetworkCredential().Password `
    -User "$env:USERDOMAIN\$env:USERNAME"

Start-ScheduledTask -TaskName $taskName

Write-Host ''
Write-Host "Tarefa '$taskName' instalada e iniciada com sucesso!" -ForegroundColor Green
Write-Host "Script: $runnerPath"
Write-Host ''
Write-Host 'A tarefa ira:'
Write-Host '  - Iniciar automaticamente quando o PC ligar (boot)'
Write-Host '  - Iniciar quando voce fizer logon'
Write-Host '  - Rodar mesmo sem logon interativo'
Write-Host '  - Reiniciar automaticamente em caso de falha (a cada 1 min)'
Write-Host '  - Funcionar em bateria'
Write-Host ''
Write-Host 'Para verificar status: .\status_24x7_task.ps1'
Write-Host 'Para remover:          .\remove_24x7_task.ps1'
