---
name: linter-validator
description: "Automated linting, syntax checking, and TypeScript validation skill. Use this skill whenever code is created, edited, or refactored to automatically run ESLint with auto-fix and verify TypeScript types without manual user intervention."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# Linter & Auto-Validator Skill

This skill automatically validates and repairs syntax, style, and typing issues after every code change.

## When to Use
- Automatically after editing or generating frontend (`client/`) or backend (`server/`) files.
- Before committing or completing a task turn.
- When fixing lint errors, missing imports, or type mismatches.

## Automated Execution
Execute the automated fix runner:
```bash
bash .agents/skills/linter-validator/scripts/lint-and-fix.sh
```

Or run targeted commands:
- **Client Lint & Fix**: `cd client && npm run lint -- --fix`
- **Client Typecheck**: `cd client && npx tsc --noEmit`
- **Server Typecheck**: `cd server && npx tsc --noEmit`
