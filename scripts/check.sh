#!/usr/bin/env bash
# Local/CI gate: build must pass and no private data may land in this public repo.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ build"
npx cf build >/dev/null 2>&1

echo "→ no personal inboxes or secrets in tracked files"
if git ls-files -z -- . ':!scripts/check.sh' | xargs -0 grep -nIE '@(gmail|icloud|hotmail|outlook)\.com|gho_|sk-[A-Za-z0-9]{20,}' -- 2>/dev/null; then
  echo "✗ private data found above" >&2
  exit 1
fi

echo "✓ ok"
