param(
  [string]$EnvFile,
  [string]$NodePath,
  [int]$Port = 4317,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$studioRoot = Join-Path $appRoot 'continuity'
if (-not $EnvFile) { $EnvFile = Join-Path $appRoot '.env' }
$EnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
if (-not $NodePath) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) { $NodePath = $nodeCommand.Source }
  else {
    $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $NodePath = $bundledNode }
  }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
  throw 'Node.js is unavailable. Pass -NodePath with the existing Node executable.'
}
if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist/public/client/app.js'))) {
  throw 'Build the Studio first: node continuity/scripts/build.mjs (from app/).'
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
$url = "http://127.0.0.1:$Port"
$running = $false
try {
  $status = Invoke-RestMethod "$url/api/studio/status" -TimeoutSec 2
  $running = $status.ai -in @('deepseek', 'off')
} catch { }
if (-not $running) {
  # The env file is read only by Node. Its contents never appear in arguments, output or browser storage.
  $oldPort = $env:PORT
  $oldMode = $env:AI_MODE
  try {
    $env:PORT = "$Port"
    $env:AI_MODE = 'deepseek'
    $server = Join-Path $studioRoot 'server/index.mjs'
    $process = Start-Process -FilePath $NodePath -ArgumentList @("--env-file=`"$EnvFile`"", "`"$server`"") -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru
  } finally {
    $env:PORT = $oldPort
    $env:AI_MODE = $oldMode
  }
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
      $status = Invoke-RestMethod "$url/api/studio/status" -TimeoutSec 2
      if ($status.ai -in @('deepseek', 'off')) { $running = $true; break }
    } catch { }
    if ($process.HasExited) { break }
  }
  if (-not $running) { throw 'Studio did not start. Check the env file and whether the port is already used.' }
}
Write-Output "AgentFlow Studio: $url (AI: $($status.ai))"
if (-not $NoBrowser) { Start-Process $url }
