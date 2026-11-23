# 本地增量更新：把新打包的程序文件覆盖进 release\自由发\resources\app，
# 严格保留 data（用户数据）、browsers（内置内核）、_data_backup_*（历史备份）。

# ⚠️ 新打包的 app 自带 repo 运行时的 data（测试残留），复制前必须剔除，
#    否则 Copy-Item -Recurse 会把测试数据合并进用户 data（v1.9.7 曾因此污染）。
param([string]$Dst = "release\自由发\resources\app", [string]$Src = "release\自由发-win32-x64\resources\app")
$ErrorActionPreference = 'Stop'
$keep = @('data', 'browsers', '_data_backup_1.9.6')
if (-not (Test-Path $Dst) -or -not (Test-Path $Src)) { throw "源/目标目录不存在: $Src / $Dst" }
# 剔除源包里的 data（测试残留），永远不往用户 data 里合并任何文件
if (Test-Path (Join-Path $Src 'data')) { Remove-Item (Join-Path $Src 'data') -Recurse -Force; Write-Output "已剔除源包 data（防污染）" }
$before = [math]::Round((Get-ChildItem (Join-Path $Dst 'data') -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Output "更新前 data 目录: $before MB"
$toRemove = Get-ChildItem $Dst -Force | Where-Object { $keep -notcontains $_.Name }
Write-Output ("将替换: " + (($toRemove | ForEach-Object { $_.Name }) -join ', '))
foreach ($item in $toRemove) { Remove-Item $item.FullName -Recurse -Force }
Copy-Item -Path (Join-Path $Src '*') -Destination $Dst -Recurse -Force
$after = [math]::Round((Get-ChildItem (Join-Path $Dst 'data') -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Output "更新后 data 目录: $after MB"
if ([math]::Abs($after - $before) -gt 1) { throw "数据目录体积变化，中止！before=$before after=$after" }
Write-Output "OK: 程序文件已更新，用户数据完好"
