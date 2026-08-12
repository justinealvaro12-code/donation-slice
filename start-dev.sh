#!/bin/bash
cd artifacts/api-server && node --enable-source-maps ./dist/index.mjs &
sleep 3
export BASE_PATH="/" PORT=5173
cd artifacts/donation-management && pnpm exec vite --config vite.config.ts --host 0.0.0.0
