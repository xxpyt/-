param(
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

function Invoke-Git {
  param([string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

# Try to resolve git from PATH, then common install path.
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
  $gitExe = "C:\Program Files\Git\cmd\git.exe"
  if (Test-Path $gitExe) {
    $env:Path = "C:\Program Files\Git\cmd;$env:Path"
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  }
}

if (-not $gitCmd) {
  Write-Host "Git is not installed or not in PATH."
  Write-Host "Install Git first: https://git-scm.com/download/win"
  exit 1
}

if (-not (Test-Path ".git")) {
  Invoke-Git @("init")
}

Invoke-Git @("add", ".")

try {
  & git commit -m "chore: deploy simulator with GitHub Pages workflow"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No new commit content, continue to push."
  }
} catch {
  throw
}

Invoke-Git @("branch", "-M", $Branch)

$remoteName = "origin"
$remoteUrl = "https://github.com/xxpyt/%E6%AF%95%E8%AE%BE.git"

$remoteList = & git remote
if ($LASTEXITCODE -ne 0) {
  throw "git remote failed with exit code $LASTEXITCODE"
}
$hasOrigin = $remoteList | Select-String -SimpleMatch $remoteName
if (-not $hasOrigin) {
  Invoke-Git @("remote", "add", $remoteName, $remoteUrl)
} else {
  Invoke-Git @("remote", "set-url", $remoteName, $remoteUrl)
}

Invoke-Git @("push", "-u", $remoteName, $Branch)

Write-Host ""
Write-Host "Push complete. GitHub Pages URL:"
Write-Host "https://xxpyt.github.io/%E6%AF%95%E8%AE%BE/"
