# AF128: optional PC entry. Map readings run with the Codex CLI already installed and signed in on this PC, under the fixed accepted
# policy (no policy file to write). It is separate from start-local.ps1 (DeepSeek), which it never changes or stops.
#   ./continuity/scripts/start-pc.ps1                      start (or reopen) and open the browser
#   ./continuity/scripts/start-pc.ps1 -CodexPath <codex.exe>   name the installed codex.exe when it is not found
#   ./continuity/scripts/start-pc.ps1 -Stop                stop this entry's own server in order
# Nothing is installed, updated, downloaded or signed in to; starting, checking and stopping make no generation.
param(
  [string]$CodexPath,
  [string]$NodePath,
  [string]$EnvFile,
  [int]$Port = 4327,
  [switch]$Stop,
  [switch]$InterruptRunning,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$entry = Join-Path $PSScriptRoot 'pc-entry.mjs'
if (-not $NodePath) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) { $NodePath = $nodeCommand.Source }
  else {
    $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $NodePath = $bundledNode }
  }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) { throw 'Node.js를 찾지 못했어요. -NodePath로 기존 node.exe를 알려 주세요.' }
if ($Port -lt 1024 -or $Port -gt 65535) { throw '포트는 1024~65535 사이여야 해요.' }
function Invoke-Entry([string[]]$entryArgs) {
  $out = & $NodePath $entry @entryArgs
  $code = $LASTEXITCODE
  try { $r = ($out | Select-Object -Last 1) | ConvertFrom-Json } catch { throw "확인하지 못했어요: $out" }
  return @{ result = $r; code = $code }
}
$url = "http://127.0.0.1:$Port"

if ($Stop) {
  # Stopping needs no Codex executable: the running entry is told by its own run record (a changed or removed codex.exe still stops).
  $stopArgs = @('stop', '--port', "$Port")
  if ($InterruptRunning) { $stopArgs += '--interrupt-running' }
  $s = Invoke-Entry $stopArgs
  Write-Output $s.result.message
  exit $s.code
}
$codexArgs = @(); if ($CodexPath) { $codexArgs = @('--codex', (Resolve-Path -LiteralPath $CodexPath).Path) }
if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'continuity/dist/public/client/app.js'))) {
  throw '먼저 Studio를 빌드하세요: node continuity/scripts/build.mjs (app/에서).'
}
$c = Invoke-Entry (@('check', '--port', "$Port") + $codexArgs)
if ($c.code -ne 0) { Write-Output $c.result.message; exit $c.code }
if ($c.result.port -eq 'free') {
  # The env file (optional: DeepSeek for the other features) is read only by Node; its contents never appear in arguments or output.
  if (-not $EnvFile) { $EnvFile = Join-Path $appRoot '.env' }
  $nodeArgs = @("--env-file-if-exists=`"$EnvFile`"", "`"$entry`"", 'serve', '--port', "$Port", '--codex', "`"$($c.result.exe)`"")
  $process = Start-Process -FilePath $NodePath -ArgumentList $nodeArgs -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru
  $started = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    $c = Invoke-Entry (@('check', '--port', "$Port") + $codexArgs)
    if ($c.result.port -eq 'ours') { $started = $true; break }
    if ($process.HasExited) { break }
  }
  if (-not $started) { throw "PC 입구가 시작되지 않았어요. 같은 작업 기록이나 지도 실행기를 다른 Studio가 쓰고 있는지 확인하세요. ($($c.result.message))" }
  Write-Output "AgentFlow Studio(PC, Codex): $url  ·  $($c.result.message -replace '^이미 실행 중인 이 입구를 다시 열어요. ', '')"
} else {
  Write-Output "AgentFlow Studio(PC, Codex): $url  ·  $($c.result.message)"
}
Write-Output "종료: ./continuity/scripts/start-pc.ps1 -Stop -Port $Port"
if (-not $NoBrowser) { Start-Process $url }
