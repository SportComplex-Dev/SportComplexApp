#!/bin/bash
# frontend-premium verify
set -e
pnpm --filter web typecheck 2>&1 | tail -n 10
echo "--- web importando src de packages (debe ser 0) ---"
grep -rn "packages/features" apps/web/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
