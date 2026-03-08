$ErrorActionPreference = 'Stop'

$taskName = 'NF-Importer-24x7'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Tarefa '$taskName' removida com sucesso."
} else {
    Write-Host "Tarefa '$taskName' não existe."
}
