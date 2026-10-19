#!/bin/bash
# backend-contract verify
set -e
pnpm --filter @sportcomplex/db db:generate 2>&1 | tail -n 5
pnpm --filter @sportcomplex/validation --filter @sportcomplex/db typecheck 2>&1 | tail -n 10
