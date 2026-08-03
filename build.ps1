$ErrorActionPreference = "Stop"
taskkill /F /IM FrameVault.exe 2>$null
cd "apps\standalone"
npm run build -- --publish always
