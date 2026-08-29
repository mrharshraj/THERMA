param([string[]]$Routes = @())
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$dir = Join-Path $env:TEMP 'opencode\routedump'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# Reuse a running backend if present; otherwise start one.
$haveServer = $false
try { Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2 | Out-Null; $haveServer = $true } catch {}
$p = $null
if (-not $haveServer) {
  $p = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $env:TEMP 'opencode\srv.out') `
    -RedirectStandardError (Join-Path $env:TEMP 'opencode\srv.err')
  $ok = $false
  foreach ($i in 1..20) {
    Start-Sleep -Milliseconds 700
    try { Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2 | Out-Null; $ok = $true; break } catch {}
  }
  if (-not $ok) { Write-Output 'SERVER DID NOT START'; if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }; exit 1 }
}

foreach ($r in $Routes) {
  $name = ($r -replace '[/\\]', '-')
  $prof = Join-Path $env:TEMP "opencode\cp-$name"
  $htmlPath = Join-Path $dir "$name.html"
  $logPath = Join-Path $dir "$name.log"
  cmd /c "`"$chrome`" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --user-data-dir=`"$prof`" --virtual-time-budget=10000 --dump-dom `"http://localhost:3000/#$r`" > `"$htmlPath`" 2> `"$logPath`""
  $bytes = 0
  if (Test-Path $htmlPath) { $bytes = (Get-Item $htmlPath).Length }
  $bad = $false; $err = $false; $h1 = ''
  if ($bytes -gt 0) {
    $raw = Get-Content $htmlPath -Raw
    if ($raw) {
      $bad = $raw.Contains('Screen unavailable')
      $err = (Select-String -Path $logPath -Pattern 'Uncaught|ERROR:console' -Quiet)
      $h1 = ([regex]::Match($raw, '<h1[^>]*>([\s\S]{0,90}?)</h1>')).Groups[1].Value -replace '\s+', ' '
    }
  }
  Write-Output ("{0,-24} crash={1} jserr={2} bytes={3}  h1={4}" -f $name, [int][bool]$bad, [int][bool]$err, $bytes, $h1)
}
if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
