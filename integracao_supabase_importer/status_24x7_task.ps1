$taskName = 'NF-Importer-24x7'

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "Tarefa '$taskName' não encontrada."
    exit 1
}

$info = Get-ScheduledTaskInfo -TaskName $taskName
Write-Host "TaskName: $taskName"
Write-Host "State: $($task.State)"
Write-Host "LastRunTime: $($info.LastRunTime)"
Write-Host "LastTaskResult: $($info.LastTaskResult)"
Write-Host "NextRunTime: $($info.NextRunTime)"
