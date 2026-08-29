param($iterations = 1)

# Start server
Write-Host "Starting THERMA server..."
cmd /c "cd C:\Users\Broken Crown\Music\THERMA && node server.js > NUL 2>&1"
Start-Sleep -Seconds 3

# Verify health
for ($i = 0; $i -lt 10; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 3
        Write-Host "HEALTH CHECK $($i+1): OK - OK"
        break
    } catch {
        Write-Host "HEALTH CHECK $($i+1): waiting..."
        Start-Sleep -Seconds 1
    }
}

if ($i -ge 10) {
    Write-Host "ERROR: Server not responding after 10 seconds"
    exit 1
}

Write-Host "Server is running. Running Zoe tests..."

# Run a simple Zoe test
try {
    $body = '{"message":"Which area is hottest?","context":{"location":{"id":"miami-downtown","display":"Downtown Miami"},"screen":"heat"}}'
    $r = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/zoe" -Body $body -ContentType "application/json"
    Write-Host "ZOE TEST 1 - Hottest area:"
    Write-Host "  Message: $($r.message)"
    Write-Host "  Intent: $($r.intent)"
    Write-Host "  Actions count: $($r.actions.Count)"
    if ($r.actions.Count -gt 0) {
        Write-Host "  First action: $($r.actions[0].name) - $($r.actions[0].args)"
    }
    Write-Host "  Mode: $($r.mode)"
} catch {
    Write-Host "ZOE TEST 1 - FAILED: $_"
}

# Second Zoe test
Write-Host "---"
Write-Host "ZOE TEST 2 - Open Heat Intelligence:"
try {
    $body2 = '{"message":"Open Heat Intelligence","context":{"location":{"id":"miami-downtown","display":"Downtown Miami"},"screen":"heat"}}'
    $r2 = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/zoe" -Body $body2 -ContentType "application/json"
    Write-Host "  Message: $($r2.message)"
    Write-Host "  Intent: $($r2.intent)"
    Write-Host "  Actions count: $($r2.actions.Count)"
    if ($r2.actions.Count -gt 0) {
        Write-Host "  First action: $($r2.actions[0].name) - $($r2.actions[0].args)"
    }
    Write-Host "  Mode: $($r2.mode)"
} catch {
    Write-Host "ZOE TEST 2 - FAILED: $_"
}

# Third Zoe test
Write-Host "---"
Write-Host "ZOE TEST 3 - Show alerts:"
try {
    $body3 = '{"message":"Show alerts","context":{"location":{"id":"miami-downtown","display":"Downtown Miami"},"screen":"heat"}}'
    $r3 = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/zoe" -Body $body3 -ContentType "application/json"
    Write-Host "  Message: $($r3.message)"
    Write-Host "  Intent: $($r3.intent)"
    Write-Host "  Actions count: $($r3.actions.Count)"
    if ($r3.actions.Count -gt 0) {
        Write-Host "  First action: $($r3.actions[0].name) - $($r3.actions[0].args)"
    }
    Write-Host "  Mode: $($r3.mode)"
} catch {
    Write-Host "ZOE TEST 3 - FAILED: $_"
}

Write-Host "---"
Write-Host "All Zoe tests completed."