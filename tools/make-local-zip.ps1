# 生成本地干净 zip：复制 release\自由发 -> freeflow-win64 -> 压缩（与 CI 产物一致，不含用户数据）
$ErrorActionPreference = 'Stop'
$src = 'release\自由发'
$clean = 'release\freeflow-win64'
$zip = 'release\freeflow-v1.9.7-win-x64.zip'
Remove-Item $clean -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Recurse $src $clean
Remove-Item -Recurse -Force (Join-Path $clean 'resources\app\data') -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $clean 'resources\app\_data_backup_1.9.6') -ErrorAction SilentlyContinue
Compress-Archive -Path $clean -DestinationPath $zip -CompressionLevel Optimal -Force
$info = Get-Item $zip
Write-Output "zip ok: $($info.FullName) $([math]::Round($info.Length/1MB,1)) MB"
