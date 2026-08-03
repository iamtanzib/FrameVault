$ErrorActionPreference = "Continue"
try { taskkill /F /IM FrameVault.exe 2>$null } catch {}
cd "apps\standalone"
npm run build -- --publish always
