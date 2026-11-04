#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22 ? 1 : 0)'; then
  echo 'ISPAdmin richiede Node.js 22 o successivo nel PATH.' >&2
  exit 1
fi
if [ ! -f node_modules/.package-lock.json ]; then
  npm ci --ignore-scripts --no-audit --no-fund >&2
fi
exec node src/local.mjs
