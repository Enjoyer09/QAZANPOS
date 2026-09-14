#!/usr/bin/env bash
set -e

echo "=== Running Server Tests (Vitest) ==="
npm run test --workspace=server

echo "=== Running Client Tests (Vitest) ==="
npm run test --workspace=client

echo "All tests passed successfully!"
