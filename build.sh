#!/usr/bin/env bash
# Builds a portable Windows app: dist/PokeTactix-win64.zip
set -euo pipefail
cd "$(dirname "$0")"
EV="${ELECTRON_VERSION:-45.4.1}"
rm -rf dist && mkdir -p dist/app
npx esbuild server/server.ts --bundle --platform=node --format=cjs --outfile=dist/app/server.cjs --log-level=warning
cp -r client data dist/app/
cp electron/main.cjs dist/app/main.cjs
echo '{"name":"poketactix","version":"0.1.0","main":"main.cjs"}' > dist/app/package.json
mkdir -p cache
ZIP="cache/electron-v$EV-win32-x64.zip"
[ -f "$ZIP" ] || curl -fL -o "$ZIP" "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-win32-x64.zip"
rm -rf dist/PokeTactix && mkdir -p dist/PokeTactix
unzip -q "$ZIP" -d dist/PokeTactix
mv dist/PokeTactix/electron.exe dist/PokeTactix/PokeTactix.exe
rm -rf dist/PokeTactix/resources/default_app.asar
cp -r dist/app dist/PokeTactix/resources/app
(cd dist && zip -qr PokeTactix-win64.zip PokeTactix)
ls -la dist/PokeTactix-win64.zip
