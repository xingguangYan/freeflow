# 冒烟测试：用临时数据目录启动 release\自由发 的引擎，验证 /web 路由与 API 可用。
$app = "release\自由发\resources\app"
if (-not (Test-Path (Join-Path $app 'server.js'))) { throw "release app missing: $app" }
$port = 8931
$tmp = Join-Path $env:TEMP "ff-smoke-197"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$env:FREEFLOW_PORT = $port
$env:FREEFLOW_DATA = $tmp
$proc = Start-Process -PassThru -WindowStyle Hidden -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $app -RedirectStandardOutput "$tmp\out.log" -RedirectStandardError "$tmp\err.log"
Start-Sleep -Seconds 4
try {
  $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/platforms" -TimeoutSec 5
  Write-Output "platforms: $($r.Count)"
  $w = Invoke-WebRequest -Uri "http://127.0.0.1:$port/web/index.html" -TimeoutSec 5
  Write-Output "/web route: $($w.StatusCode), has title: $($w.Content -match '自由发 · 网页版')"
  Stop-Process -Id $proc.Id -Force
  Write-Output "SMOKE OK"
} catch {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Write-Output "SMOKE FAIL: $_"
  Write-Output (Get-Content "$tmp\err.log" -ErrorAction SilentlyContinue)
}
