Kill any existing node server processes
try { Kill node } catch {}
Start-Sleep -Seconds 1

 cd "C:\Users\Broken Crown\Music\THERMA"
 nohup node server.js > /tmp/therma.log 2>&1 &
 Start-Sleep -Seconds 2

# Verify server is up
try {
    $result = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get
    Write-Host "Server is up: $($result.Content.substring(0, 100))"
} catch {
    Write-Host "Server not responding yet"
}