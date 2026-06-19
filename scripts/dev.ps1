$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
  param([string]$Operation)

  if ($LASTEXITCODE -ne 0) {
    throw "$Operation failed with exit code $LASTEXITCODE."
  }
}

Get-Content (Join-Path $PSScriptRoot "..\.env") |
  Where-Object { $_ -and -not $_.StartsWith("#") } |
  ForEach-Object {
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }

foreach ($urlVariable in @("DATABASE_URL", "REDIS_URL")) {
  $value = [Environment]::GetEnvironmentVariable($urlVariable, "Process")
  if ($value) {
    [Environment]::SetEnvironmentVariable(
      $urlVariable,
      $value.Replace("@localhost:", "@127.0.0.1:").Replace(
        "://localhost:",
        "://127.0.0.1:"
      ),
      "Process"
    )
  }
}

Set-Location (Join-Path $PSScriptRoot "..")
corepack prepare pnpm@10.12.1 --activate | Out-Null

$detectedDevOrigins = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    -not $_.IPAddress.StartsWith("169.254.")
  } |
  Select-Object -ExpandProperty IPAddress -Unique

$allowedDevOrigins = @("192.168.1.*") + @($detectedDevOrigins)
[Environment]::SetEnvironmentVariable(
  "NEXT_ALLOWED_DEV_ORIGINS",
  (($allowedDevOrigins | Select-Object -Unique) -join ","),
  "Process"
)

$apiCorsOrigins = @(
  [Environment]::GetEnvironmentVariable("API_CORS_ORIGIN", "Process") -split ","
)
foreach ($address in $detectedDevOrigins) {
  $apiCorsOrigins += "http://${address}:3000"
  $apiCorsOrigins += "http://${address}:3002"
  $apiCorsOrigins += "http://${address}:3003"
}
[Environment]::SetEnvironmentVariable(
  "API_CORS_ORIGIN",
  (($apiCorsOrigins | Where-Object { $_ } | Select-Object -Unique) -join ","),
  "Process"
)

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
Assert-LastExitCode "Building shared workspaces"

$migrationMutex = [Threading.Mutex]::new(
  $false,
  "Global\EsseBeautyDatabaseMigration"
)

if (-not $migrationMutex.WaitOne(0)) {
  $migrationMutex.Dispose()
  throw "Another database migration is already running. Wait for it to finish and run pnpm run dev again."
}

try {
  corepack pnpm --filter @esse-beauty/db run db:migrate
  Assert-LastExitCode "Applying database migrations"
}
finally {
  $migrationMutex.ReleaseMutex()
  $migrationMutex.Dispose()
}

corepack pnpm --parallel `
  --filter @esse-beauty/api `
  --filter @esse-beauty/web `
  --filter @esse-beauty/pwa `
  --filter @esse-beauty/staff-pwa `
  run dev
