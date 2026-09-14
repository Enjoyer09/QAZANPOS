---
name: code-reviewer
description: "Expert code review skill for pull requests, git diffs, security audits, performance optimization, and architectural integrity. Use this skill when the user asks to review code, audit changes, check for bugs, assess PRs, evaluate code quality, or verify compliance with clean architecture."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# Code Reviewer Skill

This skill guides the agent in conducting thorough, multi-dimensional code reviews that catch subtle bugs, security vulnerabilities, edge-case failures, and architectural regressions before code is merged or deployed.

## When to Use

Activate this skill when:
- Reviewing git diffs or uncommitted working-tree changes (`git diff`, `git status`).
- Reviewing pull requests or feature branches.
- Performing security and vulnerability audits (OWASP Top 10, auth bypass, injection, data leaks).
- Evaluating performance, memory leaks, query optimization, and scalability.
- Checking adherence to TypeScript, React, Express/Fastify, and database best practices.

---

## Review Dimensions & Checklist

Conduct the review systematically across these five dimensions:

### 1. Correctness & Edge Cases
- **Null / Undefined Handling**: Are nullable fields safely checked (`?.`, null coalescing `??`)?
- **Asynchronous Flow**: Are all Promises awaited or handled? Are unhandled rejections possible?
- **Concurrency & Race Conditions**: Are state updates atomic? Are database transactions used where multiple writes depend on each other?
- **Boundary Values**: Off-by-one errors in loops/slices, empty arrays, 0 amounts, negative quantities.

### 2. Security & Data Protection (OWASP Standards)
- **Input Validation**: Are user inputs strictly validated at API boundaries (e.g. Zod, DTOs)?
- **Authorization & Ownership**: Is object-level authorization enforced? Can User A access or mutate User B's resource?
- **SQL / Query Injection**: Are parameterized queries or ORM query builders (e.g. Drizzle ORM) strictly used?
- **Secret Leaks**: Are tokens, API keys, credentials, or `.env` files hardcoded or logged?
- **Rate Limiting & Denial of Service**: Are resource-heavy endpoints rate-limited?

### 3. Performance & Resource Management
- **Database & Query Efficiency**: Avoid N+1 queries. Ensure appropriate indices are referenced.
- **Frontend Rerenders**: In React, check for unnecessary re-renders, missing dependencies in `useEffect`, and expensive computations outside `useMemo`.
- **Memory Leaks**: Ensure event listeners, timers, and database connections are properly disposed of.

### 4. Maintainability & Clean Architecture
- **Single Responsibility**: Do functions and components do one thing well?
- **Type Safety**: Avoid `any` escapes in TypeScript. Ensure strict typing for API contracts.
- **Error Handling**: Are errors categorized with appropriate HTTP status codes and user-friendly messages rather than crashing the process?

### 5. Testability & Regressions
- Are existing tests still passing?
- Do new features include unit, integration, or E2E tests?

---

## Review Output Format

Provide feedback formatted clearly with severity levels:

```markdown
## Code Review Summary

### 🚨 Critical / P0 (Must Fix Before Merge)
- **[file.ts:line]**: Description of severe bug/vulnerability, why it happens, and suggested fix.

### ⚠️ Warning / P1 (Important Improvements)
- **[file.ts:line]**: Performance concern, edge-case flaw, or missing validation.

### 💡 Suggestion / P2 (Nitpicks & Cleanups)
- **[file.ts:line]**: Readability, naming, or minor simplification.

### ✅ Commendations & Strengths
- What was done well (patterns, test coverage, elegance).
```
