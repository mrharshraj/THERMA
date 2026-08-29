# Start THERMA server persistently
# Kill any existing on port 3000
try {
    $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($c) { foreach ($p in $c.Owner) { try { Stop-Process -Id $p -Force } catch {} } }
    Start-Sleep -Seconds 1
} catch {}

# Start node server as background job
$job = Start-Job -ScriptBlock { 
    cd "C:\Users\Broken Crown\Music\THERMA"; 
    $env:PORT = "3000"; 
    node server.js 
} -Name "THERMA_Server" -OutputEncoding utf8

Write-Host "Server job started: $($job.Id)"

# Wait for server to be ready
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $result = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 3
        Write-Host "Server is up! $($i+1) seconds waited."
        break
    } catch {
        Write-Host "Waiting for server... $($i+1)/30 seconds"
    }
}

# Verify server is alive with a second check
try {
    $result2 = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 3
    Write-Host "Second health check: OK - $($result2.Content.Substring(0, 80))"
} catch {
    Write-Host "Second health check: FAILED - server not responding"
}

# Keep the job alive and provide the PID info
Write-Host "Server running in background job $($job.Id)"
Write-Host "To keep this session alive, do not close PowerShell"
Write-Host "Server PID: $(Get-Process -Id $job.JobStateInfo.Pid -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)"