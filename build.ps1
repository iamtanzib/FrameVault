$ErrorActionPreference = "Continue"
try { taskkill /F /IM FrameVault.exe 2>$null } catch {}

# Automatically generate release notes from the latest git commits
Write-Host "Generating dynamic release notes..."
$commits = git log -n 5 --no-merges --pretty=format:"- %s"
$notes = "# What's New in FrameVault`n`n$commits"
$notes | Out-File -FilePath "apps\standalone\build\release-notes.md" -Encoding utf8

cd "apps\standalone"
npm run build -- --publish always
