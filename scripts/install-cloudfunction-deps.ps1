param(
  [string]$FunctionRoot = "health-miniapp-client/cloudfunctions"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $FunctionRoot)) {
  throw "函数目录不存在: $FunctionRoot"
}

Write-Host "Installing cloud function dependencies under: $FunctionRoot"

$dirs = Get-ChildItem -Path $FunctionRoot -Directory
foreach ($dir in $dirs) {
  $pkg = Join-Path $dir.FullName "package.json"
  if (-not (Test-Path $pkg)) { continue }

  Write-Host ""
  Write-Host "==> $($dir.Name)"
  Push-Location $dir.FullName
  try {
    npm install --production
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Done. Please re-upload cloudfunctions to CloudBase."

