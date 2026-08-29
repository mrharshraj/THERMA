param([Parameter(Mandatory = $true)][string]$Route)
$name = ($Route -replace '[/\\:?*<>|"]', '-')
$dir = Join-Path $env:TEMP 'opencode\routedump'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$htmlPath = Join-Path $dir "$name.html"
$logPath = Join-Path $dir "$name.log"
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
cmd /c "`"$chrome`" --headless --no-sandbox --disable-gpu --enable-logging=stderr --no-first-run --user-data-dir=`"$(Join-Path $env:TEMP "opencode\cpw-$name")`" --virtual-time-budget=10000 --dump-dom `"http://localhost:3000/#$Route`" > `"$htmlPath`" 2> `"$logPath`""
$raw = Get-Content $htmlPath -Raw
if (-not $raw) { $raw = '' }
$bad = $raw.Contains('Screen unavailable')
$err = Select-String -Path $logPath -Pattern 'Uncaught|ERROR:console|Failed to load module' -Quiet
$h1 = ([regex]::Match($raw, '<h1[^>]*>([\s\S]{0,90}?)</h1>')).Groups[1].Value -replace '\s+', ' '
Write-Output ("{0,-24} crash={1} jserr={2} bytes={3} h1={4}" -f $name, [int][bool]$bad, [int][bool]$err, $raw.Length, $h1)
