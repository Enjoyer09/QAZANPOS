#!/usr/bin/env bash
set -e

echo "=== Railway Status ==="
railway status || echo "Run 'railway link' to select an active project."
