$ErrorActionPreference = "Stop"

Get-Content (Join-Path $PSScriptRoot "..\.env") |
  Where-Object { $_ -and -not $_.StartsWith("#") } |
  ForEach-Object {
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }

Set-Location (Join-Path $PSScriptRoot "..")
corepack prepare pnpm@10.12.1 --activate | Out-Null
corepack pnpm --parallel `
  --filter @esse-beauty/api `
  --filter @esse-beauty/web `
  --filter @esse-beauty/pwa `
  run dev
