$ErrorActionPreference = 'Continue'
$job = Start-Job -ScriptBlock { Set-Location "C:\Users\Broken Crown\Music\THERMA"; node server.js 2>&1 }
Start-Sleep -Seconds 3

Write-Output "Requesting LIVE temperature grid for Miami downtown (real FortyGuard call, may take 1-4 min)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $g = Invoke-RestMethod -Uri 'http://localhost:3000/api/context/grid?place=miami-downtown&layer=temperature&demo=0' -TimeoutSec 300
  $sw.Stop()
  Write-Output "LIVE GRID OK in $([math]::Round($sw.Elapsed.TotalSeconds,1))s: source=$($g.source) tiles=$($g.grid.Count) units=$($g.units)"
  Write-Output "stats: min=$($g.stats.min) mean=$([math]::Round($g.stats.mean,2)) max=$($g.stats.max)"
} catch { $sw.Stop(); Write-Output "ERR live grid: $($_.Exception.Message)" }

Write- "--- server log ---"
Receive-Job $job -Keep | Select-Object -Last 15
Stop-Job $job
Remove-Job $job -Force