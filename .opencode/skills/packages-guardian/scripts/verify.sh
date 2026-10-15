#!/bin/bash
# packages-guardian verify
set -e
pnpm verificar:limites --all 2>&1 | tail -n 20
echo "--- subpath /src (debe ser 0) ---"
grep -rn "@sportcomplex/.*/src" packages/*/src apps/web/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
