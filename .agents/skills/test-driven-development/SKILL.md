---
name: test-driven-development
description: "Comprehensive test-driven development (TDD), unit testing, integration testing, and E2E testing skill. Use this skill when writing tests with Vitest, Jest, Supertest, Playwright, or React Testing Library, designing test suites, fixing bugs via regression tests, or measuring test coverage."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# Test-Driven Development (TDD) & Testing Suite Skill

This skill enforces high-standard automated testing practices, bug regression testing, and resilient test architecture across full-stack applications.

## When to Use

Activate this skill when:
- Writing new unit tests, integration tests, or API endpoint tests.
- Implementing features using strict Test-Driven Development (Red-Green-Refactor).
- Fixing bugs: writing reproducing regression tests before applying the fix.
- Writing end-to-end tests using Playwright.
- Testing React 19 components with React Testing Library and JSDOM.
- Running and analyzing test suites with Vitest.

---

## The TDD Workflow

Always adhere to the three phases:

```text
[ Red ]   -> Write a minimal test capturing the requirement/bug that fails.
[ Green ] -> Implement the simplest code that makes the test pass.
[ Refactor ] -> Clean up code, remove duplication, and optimize while keeping tests green.
```

---

## Stack-Specific Testing Runbook

### 1. Backend Integration Testing (Express + Supertest + Vitest)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('POST /api/orders', () => {
  it('should create an order and return 201 with order payload', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ tableId: 1, items: [{ productId: 5, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toHaveProperty('id');
  });

  it('should reject invalid payload with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({});

    expect(res.status).toBe(400);
  });
});
```

### 2. Frontend Component Testing (React 19 + Testing Library + Vitest)
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuantityCounter } from './QuantityCounter';

describe('QuantityCounter', () => {
  it('increments quantity when plus button is clicked', () => {
    const onChange = vi.fn();
    render(<QuantityCounter value={1} onChange={onChange} />);
    
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
```

### 3. Execution Commands
- Run backend tests: `npm run test --workspace=server`
- Run frontend tests: `npm run test --workspace=client`
- Run Playwright E2E: `npm run test:e2e --workspace=client`
