$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $workspaceRoot

function Assert-LastExitCode {
  param([string]$Operation)

  if ($LASTEXITCODE -ne 0) {
    throw "$Operation failed with exit code $LASTEXITCODE."
  }
}

Get-Content (Join-Path $workspaceRoot ".env") |
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

$postgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$postgresDatabase = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "esse_beauty" }

$dbStatus = docker compose ps db --format json | ConvertFrom-Json
Assert-LastExitCode "Reading PostgreSQL container status"

if (-not $dbStatus -or $dbStatus.State -ne "running") {
  docker compose up -d db
  Assert-LastExitCode "Starting PostgreSQL container"
}

docker compose exec -T db psql `
  -v ON_ERROR_STOP=1 `
  -U $postgresUser `
  -d $postgresDatabase `
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;"
Assert-LastExitCode "Clearing PostgreSQL schemas"

corepack pnpm --dir packages/db exec drizzle-kit migrate
Assert-LastExitCode "Applying database migrations"

$salonCount = docker compose exec -T db psql `
  -tA `
  -U $postgresUser `
  -d $postgresDatabase `
  -c "SELECT count(*) FROM salons;"
Assert-LastExitCode "Checking salons table"

$migrationCount = docker compose exec -T db psql `
  -tA `
  -U $postgresUser `
  -d $postgresDatabase `
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations;"
Assert-LastExitCode "Checking migration history"

if (($salonCount | Out-String).Trim() -ne "0") {
  throw "Database reset failed: salons table is not empty."
}

if ([int](($migrationCount | Out-String).Trim()) -lt 1) {
  throw "Database reset failed: no migrations were recorded."
}

Write-Host "Database cleared and migrations applied successfully."
