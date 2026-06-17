$ErrorActionPreference = "Stop"

Get-Content (Join-Path $PSScriptRoot "..\.env") |
  Where-Object { $_ -and -not $_.StartsWith("#") } |
  ForEach-Object {
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }

Set-Location (Join-Path $PSScriptRoot "..")
corepack prepare pnpm@10.12.1 --activate | Out-Null

$busyPorts = Get-NetTCPConnection -LocalPort 3000, 3001, 3002, 3003 -State Listen -ErrorAction SilentlyContinue
if ($busyPorts) {
  $ports = ($busyPorts | Select-Object -ExpandProperty LocalPort -Unique) -join ", "
  throw "Development ports already in use: $ports. Stop the existing dev server or free these ports before running pnpm run dev."
}

corepack pnpm `
  --filter @esse-beauty/db `
  --filter @esse-beauty/shared `
  --filter @esse-beauty/feature-flags `
  --filter @esse-beauty/ui `
  run build

corepack pnpm --filter @esse-beauty/db run db:migrate

corepack pnpm --parallel `
  --filter @esse-beauty/api `
  --filter @esse-beauty/web `
  --filter @esse-beauty/pwa `
  --filter @esse-beauty/staff-pwa `
  run dev
