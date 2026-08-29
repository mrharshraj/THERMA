$ErrorActionPreference = 'Continue'
$job = Start-Job -ScriptBlock { Set-Location "C:\Users\Broken Crown\Music\THERMA"; node server.js 2>&1 }
Start-Sleep -Seconds 3

try {
  $h = Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 15
  Write-Output "HEALTH OK: fg=$($h.services.fortyguard.available) gemini=$($h.services.gemini.available)"
} catch { Write-Output "ERR health: $($_.Exception.Message)" }

try {
  $s = Invoke-RestMethod -Uri 'http://localhost:3000/api/geo/search?q=miami%20beach' -TimeoutSec 25
  Write-Output "SEARCH OK: $($s.results.Count) results -> $(($s.results | Select-Object -First 3 | ForEach-Object { $_.display }) -join ', ')"
} catch { Write-Output "ERR search: $($_.Exception.Message)" }

$zoeBody = @{
  message = 'Which area is hottest?'
  context = @{
    location = @{ display = 'Miami, FL' }
    heat = @{
      stats = @{ mean = 31.2; max = 34.8; min = 28.9 }
      topAreas = @(
        @{ label = 'Downtown'; tempF = 95 },
        @{ label = 'Brickell'; tempF = 93 }
      )
    }
  }
} | ConvertTo-Json -Depth 6
try {
  $z = Invoke-RestMethod -Uri 'http://localhost:3000/api/zoe' -Method Post -Body $zoeBody -ContentType 'application/json' -TimeoutSec 20
  Write-Output "ZOE OK: mode=$($z.mode) intent=$($z.intent) viz=$($z.visualization.type)"
  Write-Output "  msg: $($z.message)"
} catch { Write-Output "ERR zoe: $($_.Exception.Message)" }

$oosBody = @{ message = 'Who is the Prime Minister of India?' } | ConvertTo-Json
try {
  $z2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/zoe' -Method Post -Body $oosBody -ContentType 'application/json' -TimeoutSec 20
  Write-Output "ZOE OOS: intent=$($z2.intent)"
  Write-Output "  msg: $($z2.message)"
} catch { Write-Output "ERR zoe-oos: $($_.Exception.Message)" }

try {
  $d = Invoke-RestMethod -Uri 'http://localhost:3000/api/context?place=miami-downtown&demo=1' -TimeoutSec 30
  Write-Output "CONTEXT OK: source=$($d.source) tiles=$($d.heatmap.grid.Count) alerts=$($d.alerts.Count) assets=$($d.assets.Count) recs=$($d.recommendations.Count)"
} catch { Write-Output "ERR ctx: $($_.Exception.Message)" }

try {
  $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/routes?from=25.7617,-80.1918&to=25.7907,-80.1300&mode=driving&demo=1' -TimeoutSec 30
  Write-Output "ROUTES(demo) OK: $($r.routes.Count) routes"
} catch { Write-Output "ERR routes-demo: $($_.Exception.Message)" }

try {
  $r2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/routes?from=25.7617,-80.1918&to=25.7907,-80.1300&mode=driving' -TimeoutSec 45
  Write-Output "ROUTES(live OSRM) OK: $($r2.routes.Count) routes, first=$([math]::Round($r2.routes[0].distanceMeters/1000,1))km"
} catch { Write-Output "ERR routes-live: $($_.Exception.Message)" }

Write-Output "--- server log ---"
Receive-Job $job -Keep | Select-Object -Last 25
Stop-Job $job
Remove-Job $job -Force