$ErrorActionPreference = "Stop"
trap {
  Write-Error $_
  exit 1
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$seedPath = Join-Path $PSScriptRoot "seed-minimal-salon.sql"
$containerName = "esse-beauty-seed-test-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$previousDatabaseUrl = $env:DATABASE_URL

if (-not (Test-Path -LiteralPath $seedPath)) {
  throw "Seed script missing: $seedPath"
}

try {
  docker run --rm -d `
    --name $containerName `
    -e POSTGRES_DB=esse_beauty_seed_test `
    -e POSTGRES_USER=postgres `
    -e POSTGRES_PASSWORD=seed-test-password `
    -p 127.0.0.1::5432 `
    postgres:16-alpine | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker exec $containerName pg_isready -U postgres -d esse_beauty_seed_test 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw "Temporary PostgreSQL did not become ready"
  }

  $binding = docker port $containerName 5432/tcp
  $port = ($binding -split ":")[-1]
  $env:DATABASE_URL = "postgresql://postgres:seed-test-password@127.0.0.1:$port/esse_beauty_seed_test"

  Push-Location $repositoryRoot
  try {
    pnpm --filter @esse-beauty/db db:migrate
    if ($LASTEXITCODE -ne 0) { throw "Database migrations failed" }
  } finally {
    Pop-Location
  }

  foreach ($run in 1..2) {
    Get-Content -Raw -LiteralPath $seedPath |
      docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d esse_beauty_seed_test
    if ($LASTEXITCODE -ne 0) { throw "Seed run $run failed" }
  }

  $counts = docker exec $containerName psql -At -F ',' -U postgres -d esse_beauty_seed_test -c @"
SELECT
  (SELECT count(*) FROM salons),
  (SELECT count(*) FROM staff),
  (SELECT count(*) FROM services),
  (SELECT count(*) FROM inventory_products),
  (SELECT count(*) FROM customers),
  (SELECT count(*) FROM appointments);
"@
  if ($LASTEXITCODE -ne 0) { throw "Unable to inspect seeded database" }
  if ($counts.Trim() -ne "1,2,10,5,0,0") {
    throw "Unexpected seed counts: $($counts.Trim())"
  }

  Write-Output "Seed verified: 1 salon, 2 staff, 10 services, 5 products, no customers or appointments."
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  docker stop $containerName 2>&1 | Out-Null
}
