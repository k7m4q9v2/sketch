param([Parameter(Mandatory=$true)][string]$WasiSdk)
$ErrorActionPreference='Stop'
$taskBuildRoot=Split-Path $PSScriptRoot -Parent
$taskBuildTemp=Join-Path $taskBuildRoot 'work/wasm-build'
New-Item -ItemType Directory -Force $taskBuildTemp | Out-Null
$env:TEMP=(Resolve-Path $taskBuildTemp).Path
$env:TMP=$env:TEMP
& "$WasiSdk/bin/clang++.exe" "$PSScriptRoot/bridge.cpp" "--sysroot=$WasiSdk/share/wasi-sysroot" -std=c++17 -O3 -fno-strict-aliasing -fno-exceptions -fno-rtti -mexec-model=reactor '-Wl,--initial-memory=8388608' '-Wl,--max-memory=2147483648' '-Wl,-z,stack-size=1048576' -o "$taskBuildRoot/site/lumafont.wasm"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
