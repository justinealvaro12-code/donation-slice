#!/bin/bash
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1
export PORT=3000
export BASE_PATH=/
pnpm --filter donation-management dev
