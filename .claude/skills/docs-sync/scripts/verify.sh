#!/bin/bash
# docs-sync verify — valida docs sin romper nada.
set -e
pnpm docs:check
echo "--- H1 por tarea (debe ser 0) ---"
grep -rn "^# TSK-" docs/ --include="*.md" | wc -l
echo "--- placeholders (debe ser 0) ---"
grep -rn "tudominio.com" docs/ --include="*.md" | wc -l
echo "--- links legacy (revisar) ---"
grep -rnoE '\]\(\./[^)]+\.md\)' docs packages/*/README.md apps/web/README.md 2>/dev/null | head -20 || true
