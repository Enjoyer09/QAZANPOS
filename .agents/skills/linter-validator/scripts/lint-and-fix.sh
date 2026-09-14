#!/usr/bin/env bash
set -e

echo "=== Running ESLint with Auto-Fix on Client ==="
if [ -d "client" ]; then
  (cd client && npm run lint -- --fix || npx eslint src/ --fix || echo "Client linting finished with warnings/errors")
fi

echo "=== Running TypeScript Typecheck on Client ==="
if [ -d "client" ]; then
  (cd client && npx tsc --noEmit || echo "TypeScript typecheck failed")
fi

echo "=== Running TypeScript Typecheck on Server ==="
if [ -d "server" ]; then
  (cd server && npx tsc --noEmit || echo "Server typecheck failed")
fi

echo "=== Lint and Validation Complete ==="
