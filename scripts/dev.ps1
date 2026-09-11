$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try {
  chcp 65001 > $null
}
catch {
}

# ============================================================
# EsseBeauty - Development Environment Launcher
# ============================================================

function Write-Step {
  param(
    [int]$Number,
    [int]$Total,
    [string]$Message
  )

  Write-Host ""
  Write-Host "[$Number/$Total] " -ForegroundColor DarkGray -NoNewline
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)

  Write-Host "  [OK]   " -ForegroundColor Green -NoNewline
  Write-Host $Message -ForegroundColor Gray
}

function Write-Info {
  param([string]$Message)

  Write-Host "  [INFO] " -ForegroundColor Blue -NoNewline
  Write-Host $Message -ForegroundColor Gray
}

function Write-Warn {
  param([string]$Message)

  Write-Host "  [WARN] " -ForegroundColor Yellow -NoNewline
  Write-Host $Message -ForegroundColor Gray
}

function Assert-LastExitCode {
  param([string]$Operation)

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [ERROR] " -ForegroundColor Red -NoNewline
    Write-Host "$Operation failed with exit code $LASTEXITCODE." -ForegroundColor Red

    throw "$Operation failed with exit code $LASTEXITCODE."
  }
}

$TotalSteps = 7
$ProjectRoot = Join-Path $PSScriptRoot ".."


# ============================================================
# Header
# ============================================================

Clear-Host

$light = [char]0x2591
$block = [char]0x2588

$logoTemplate = @'
.##########                                  .########                                       .##
.##                                          .##    .##                                      .##
.##          .#######   .#######   .#######  .##    .##   .#######   .######   .##    .## .######## .##    .##
.#########  .##        .##        .##    .## .########   .##    .##       .##  .##    .##    .##    .##    .##
.##          .#######   .#######  .######### .##     .## .#########  .#######  .##    .##    .##    .##    .##
.##                .##        .## .##        .##     .## .##        .##   .##  .##   .###    .##    .##   .###
.##########  .#######   .#######   .#######  .#########   .#######   .#####.##  .#####.##     .####  .#####.##
                                                                                                           .##
                                                                                                     .#######
'@

$logo = $logoTemplate.Replace(".", $light).Replace("#", $block)

Write-Host ""
Write-Host $logo -ForegroundColor Cyan
Write-Host ""

Write-Host "                         DEVELOPMENT ENVIRONMENT" -ForegroundColor DarkCyan
Write-Host "                    Beauty Management Platform" -ForegroundColor DarkGray

Write-Host ""
Write-Host ("=" * 112) -ForegroundColor DarkCyan
Write-Host ""

Write-Host "  Environment : " -ForegroundColor DarkGray -NoNewline
Write-Host "Development" -ForegroundColor Yellow

Write-Host "  Started at  : " -ForegroundColor DarkGray -NoNewline
Write-Host (Get-Date -Format "dd/MM/yyyy HH:mm:ss") -ForegroundColor Gray

Write-Host "  Root        : " -ForegroundColor DarkGray -NoNewline
Write-Host (Resolve-Path $ProjectRoot) -ForegroundColor Gray


# ============================================================
# 1. Load environment variables
# ============================================================

Write-Step 1 $TotalSteps "Loading environment variables"

$envPath = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $envPath)) {
  Write-Host ""
  Write-Host "  [ERROR] " -ForegroundColor Red -NoNewline
  Write-Host ".env file not found: $envPath" -ForegroundColor Red

  throw ".env file not found: $envPath"
}

Get-Content $envPath |
Where-Object {
  $_ -and
  -not $_.TrimStart().StartsWith("#")
} |
ForEach-Object {

  $name, $value = $_ -split "=", 2

  if ($name) {
    [Environment]::SetEnvironmentVariable(
      $name.Trim(),
      $value,
      "Process"
    )
  }
}

Write-Ok ".env loaded"


# ============================================================
# 2. Normalize local service URLs
# ============================================================

Write-Step 2 $TotalSteps "Normalizing local service URLs"

foreach ($urlVariable in @("DATABASE_URL", "REDIS_URL")) {

  $value = [Environment]::GetEnvironmentVariable(
    $urlVariable,
    "Process"
  )

  if ($value) {

    $normalizedValue = $value.Replace(
      "@localhost:",
      "@127.0.0.1:"
    ).Replace(
      "://localhost:",
      "://127.0.0.1:"
    )

    [Environment]::SetEnvironmentVariable(
      $urlVariable,
      $normalizedValue,
      "Process"
    )

    Write-Ok "$urlVariable normalized"
  }
  else {
    Write-Warn "$urlVariable is not defined"
  }
}


# ============================================================
# 3. Prepare pnpm workspace
# ============================================================

Write-Step 3 $TotalSteps "Preparing workspace"

Set-Location $ProjectRoot

corepack prepare pnpm@10.12.1 --activate | Out-Null
Assert-LastExitCode "Preparing pnpm"

Write-Ok "pnpm 10.12.1 ready"


# ============================================================
# 4. Detect network and configure CORS
# ============================================================

Write-Step 4 $TotalSteps "Detecting development network"

$detectedDevOrigins = Get-NetIPAddress `
  -AddressFamily IPv4 `
  -ErrorAction SilentlyContinue |
Where-Object {
  $_.IPAddress -ne "127.0.0.1" -and
  -not $_.IPAddress.StartsWith("169.254.")
} |
Select-Object -ExpandProperty IPAddress -Unique

if ($detectedDevOrigins) {

  foreach ($address in $detectedDevOrigins) {
    Write-Info "Detected IPv4: $address"
  }

}
else {
  Write-Warn "No LAN IPv4 addresses detected"
}


$allowedDevOrigins = @("192.168.1.*") + @($detectedDevOrigins)

[Environment]::SetEnvironmentVariable(
  "NEXT_ALLOWED_DEV_ORIGINS",
  (($allowedDevOrigins | Select-Object -Unique) -join ","),
  "Process"
)


$apiCorsOrigins = @(
  [Environment]::GetEnvironmentVariable(
    "API_CORS_ORIGIN",
    "Process"
  ) -split ","
)

$apiCorsOrigins += "http://localhost:3004"
$apiCorsOrigins += "http://127.0.0.1:3004"

foreach ($address in $detectedDevOrigins) {
  $apiCorsOrigins += "http://${address}:3000"
  $apiCorsOrigins += "http://${address}:3002"
  $apiCorsOrigins += "http://${address}:3003"
  $apiCorsOrigins += "http://${address}:3004"
}

[Environment]::SetEnvironmentVariable(
  "API_CORS_ORIGIN",
  (
    ($apiCorsOrigins |
    Where-Object { $_ } |
    Select-Object -Unique) -join ","
  ),
  "Process"
)

Write-Ok "Development origins configured"


# ============================================================
# 5. Check development ports
# ============================================================

Write-Step 5 $TotalSteps "Checking development ports"

# 3001/3002/3003/3004/3000 are the public frontend/gateway ports; 3006/3007/3008/3009
# are the loyalty-marketing/booking/commerce/identity services, and 3011/3013
# are apps/api and apps/communications running on internal ports behind the
# dev gateway (see scripts/dev-gateway.mjs) — every one of them has to be
# free before the backend jobs below are started.
$requiredPorts = @(3000, 3001, 3002, 3003, 3004, 3006, 3007, 3008, 3009, 3011, 3013)

$busyPorts = Get-NetTCPConnection `
  -LocalPort $requiredPorts `
  -State Listen `
  -ErrorAction SilentlyContinue

if ($busyPorts) {

  $ports = (
    $busyPorts |
    Select-Object -ExpandProperty LocalPort -Unique |
    Sort-Object
  ) -join ", "

  Write-Host ""
  Write-Host "  [ERROR] " -ForegroundColor Red -NoNewline
  Write-Host "Ports already in use: $ports" -ForegroundColor Red

  throw "Development ports already in use: $ports. Stop the existing dev server or free these ports before running pnpm run dev."
}

foreach ($port in $requiredPorts) {
  Write-Ok "Port $port available"
}


# ============================================================
# 6. Build shared workspaces
# ============================================================

Write-Step 6 $TotalSteps "Building shared packages"

Write-Info "@esse-beauty/db"
Write-Info "@esse-beauty/shared"
Write-Info "@esse-beauty/server-shared"
Write-Info "@esse-beauty/feature-flags"
Write-Info "@esse-beauty/queue-client"
Write-Info "@esse-beauty/domain-events"
Write-Info "@esse-beauty/loyalty-contracts"
Write-Info "@esse-beauty/comms-contracts"
Write-Info "@esse-beauty/ui"

Write-Host ""

corepack pnpm `
  --filter @esse-beauty/db `
  --filter @esse-beauty/shared `
  --filter @esse-beauty/server-shared `
  --filter @esse-beauty/feature-flags `
  --filter @esse-beauty/queue-client `
  --filter @esse-beauty/domain-events `
  --filter @esse-beauty/loyalty-contracts `
  --filter @esse-beauty/comms-contracts `
  --filter @esse-beauty/ui `
  run build

Assert-LastExitCode "Building shared workspaces"

Write-Ok "Shared packages built successfully"


# ============================================================
# 7. Database migrations
# ============================================================

Write-Step 7 $TotalSteps "Applying database migrations"

$migrationMutex = [Threading.Mutex]::new(
  $false,
  "Global\EsseBeautyDatabaseMigration"
)

if (-not $migrationMutex.WaitOne(0)) {

  $migrationMutex.Dispose()

  Write-Host ""
  Write-Host "  [ERROR] " -ForegroundColor Red -NoNewline
  Write-Host "Another database migration is already running." -ForegroundColor Red

  throw "Another database migration is already running. Wait for it to finish and run pnpm run dev again."
}

try {

  corepack pnpm `
    --filter @esse-beauty/db `
    run db:migrate

  Assert-LastExitCode "Applying database migrations"

  Write-Ok "Database is up to date"
}
finally {

  $migrationMutex.ReleaseMutex()
  $migrationMutex.Dispose()
}


# ============================================================
# Start backend services
# ============================================================
#
# apps/api, apps/communications, apps/loyalty-marketing, apps/booking,
# apps/commerce and apps/identity each read PORT from the environment, so
# they run as separate background jobs with distinct internal ports behind a
# small local proxy (scripts/dev-gateway.mjs) that stands in for
# gateway/nginx.conf — this keeps every frontend's NEXT_PUBLIC_API_URL (port
# 3001) working unchanged no matter which backend actually owns a given
# route.

$apiInternalPort = 3011
$communicationsPort = 3013
$loyaltyMarketingPort = 3006
$bookingPort = 3007
$commercePort = 3008
$identityPort = 3009
$backendEnv = @{}
foreach ($entry in [Environment]::GetEnvironmentVariables("Process").GetEnumerator()) {
  $backendEnv[$entry.Key] = $entry.Value
}

$apiJob = Start-Job -Name "esse-beauty-api" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/api run dev
} -ArgumentList $ProjectRoot, $backendEnv, $apiInternalPort

$communicationsJob = Start-Job -Name "esse-beauty-communications" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/communications run dev
} -ArgumentList $ProjectRoot, $backendEnv, $communicationsPort

$loyaltyMarketingJob = Start-Job -Name "esse-beauty-loyalty-marketing" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/loyalty-marketing run dev
} -ArgumentList $ProjectRoot, $backendEnv, $loyaltyMarketingPort

$bookingJob = Start-Job -Name "esse-beauty-booking" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/booking run dev
} -ArgumentList $ProjectRoot, $backendEnv, $bookingPort

$commerceJob = Start-Job -Name "esse-beauty-commerce" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/commerce run dev
} -ArgumentList $ProjectRoot, $backendEnv, $commercePort

$identityJob = Start-Job -Name "esse-beauty-identity" -ScriptBlock {
  param($repoRoot, $env, $port)
  foreach ($key in $env.Keys) { [Environment]::SetEnvironmentVariable($key, $env[$key], "Process") }
  [Environment]::SetEnvironmentVariable("PORT", $port, "Process")
  Set-Location $repoRoot
  corepack pnpm --filter @esse-beauty/identity run dev
} -ArgumentList $ProjectRoot, $backendEnv, $identityPort

$gatewayJob = Start-Job -Name "esse-beauty-dev-gateway" -ScriptBlock {
  param($repoRoot, $apiPort, $communicationsPort, $loyaltyMarketingPort, $bookingPort, $commercePort, $identityPort)
  $env:API_INTERNAL_PORT = $apiPort
  $env:COMMUNICATIONS_PORT = $communicationsPort
  $env:LOYALTY_MARKETING_PORT = $loyaltyMarketingPort
  $env:BOOKING_PORT = $bookingPort
  $env:COMMERCE_PORT = $commercePort
  $env:IDENTITY_PORT = $identityPort
  Set-Location $repoRoot
  node scripts/dev-gateway.mjs
} -ArgumentList $ProjectRoot, $apiInternalPort, $communicationsPort, $loyaltyMarketingPort, $bookingPort, $commercePort, $identityPort

Write-Ok "Backend services starting (api, communications, loyalty-marketing, booking, commerce, identity, gateway)"


# ============================================================
# Ready
# ============================================================

Write-Host ""
Write-Host ""
Write-Host ("=" * 112) -ForegroundColor DarkGreen
Write-Host ""
Write-Host "                                      ESSE BEAUTY IS READY" -ForegroundColor Green
Write-Host ""
Write-Host ("=" * 112) -ForegroundColor DarkGreen
Write-Host ""

Write-Host "  LOCAL SERVICES" -ForegroundColor Yellow
Write-Host ""

Write-Host "  Web        " -ForegroundColor DarkGray -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Cyan

Write-Host "  API        " -ForegroundColor DarkGray -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "               (gateway: api, communications, loyalty-marketing, booking, commerce, identity)" -ForegroundColor DarkGray

Write-Host "  PWA        " -ForegroundColor DarkGray -NoNewline
Write-Host "http://localhost:3002" -ForegroundColor Cyan

Write-Host "  Staff PWA  " -ForegroundColor DarkGray -NoNewline
Write-Host "http://localhost:3003" -ForegroundColor Cyan

Write-Host "  Platform   " -ForegroundColor DarkGray -NoNewline
Write-Host "http://localhost:3004" -ForegroundColor Cyan


# ============================================================
# LAN URLs
# ============================================================

if ($detectedDevOrigins) {

  Write-Host ""
  Write-Host "  LAN ACCESS" -ForegroundColor Yellow
  Write-Host ""

  foreach ($address in $detectedDevOrigins) {

    Write-Host "  Network    " -ForegroundColor DarkGray -NoNewline
    Write-Host $address -ForegroundColor White

    Write-Host "    Web      " -ForegroundColor DarkGray -NoNewline
    Write-Host "http://${address}:3000" -ForegroundColor Cyan

    Write-Host "    PWA      " -ForegroundColor DarkGray -NoNewline
    Write-Host "http://${address}:3002" -ForegroundColor Cyan

    Write-Host "    Staff    " -ForegroundColor DarkGray -NoNewline
    Write-Host "http://${address}:3003" -ForegroundColor Cyan

    Write-Host "    Platform " -ForegroundColor DarkGray -NoNewline
    Write-Host "http://${address}:3004" -ForegroundColor Cyan

    Write-Host ""
  }
}


# ============================================================
# Start frontends
# ============================================================

Write-Host ("-" * 112) -ForegroundColor DarkGray
Write-Host ""

Write-Host "  Press CTRL+C to stop all development services." -ForegroundColor DarkGray

Write-Host ""
Write-Host ("-" * 112) -ForegroundColor DarkGray
Write-Host "  LIVE SERVICE LOGS" -ForegroundColor Yellow
Write-Host ("-" * 112) -ForegroundColor DarkGray
Write-Host ""

try {
  corepack pnpm --parallel `
    --filter @esse-beauty/web `
    --filter @esse-beauty/pwa `
    --filter @esse-beauty/staff-pwa `
    --filter @esse-beauty/admin `
    run dev

  Assert-LastExitCode "Running development services"
}
finally {
  $apiJob, $communicationsJob, $loyaltyMarketingJob, $bookingJob, $commerceJob, $identityJob, $gatewayJob | Stop-Job -PassThru | Receive-Job
  $apiJob, $communicationsJob, $loyaltyMarketingJob, $bookingJob, $commerceJob, $identityJob, $gatewayJob | Remove-Job -Force
}
