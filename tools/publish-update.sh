#!/usr/bin/env bash
# Builds the game bundle and force-pushes it to the "updates" branch; installed apps pick it up on next launch.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist/update; rm -rf "$OUT" && mkdir -p "$OUT"
npx esbuild server/server.ts --bundle --platform=node --format=cjs --outfile="$OUT/server.cjs" --log-level=error
cp -r client data "$OUT/"
node tools/make-manifest.mjs "$OUT"
cd "$OUT"; rm -rf .git; git init -q -b updates; git add -A
git -c user.name="PokeTacTix build" -c user.email="build@poketactix.local" commit -qm "game bundle $(date -u +%Y-%m-%d\ %H:%M)"
git push -q --force "${PUBLISH_REMOTE:-https://github.com/PokeVerseMMO/poketactix}" updates:updates
echo "published. Running apps update on next launch."
