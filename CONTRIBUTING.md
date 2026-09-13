# Contributing to QAZANPOS

Thank you for your interest in contributing to **QAZANPOS** — an open-source, modern Point of Sale (POS) and kitchen management platform built with React 19, TypeScript, Tailwind CSS v4, Express, and Drizzle ORM.

## Code of Conduct
We are committed to providing a welcoming, diverse, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all interactions.

## How to Contribute

### 1. Reporting Bugs
- Search existing issues to ensure the bug has not already been reported.
- If not, open a new issue detailing:
  - Clear, reproducible steps.
  - Expected vs. actual behavior.
  - Screenshots, console logs, or network requests if applicable.

### 2. Suggesting Enhancements
- Open an issue describing the feature request and the specific problem it solves for merchants or cashiers.
- Outline the proposed architectural changes or UI flow.

### 3. Submitting Pull Requests (PRs)
1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Coding Standards**:
   - Write clean, modular TypeScript with strict type safety.
   - Adhere to the existing ESLint and code style rules.
   - Run linter and typecheck before submitting:
     ```bash
     npm run build
     ```
4. **Testing**:
   - Add unit/integration tests for your changes.
   - Verify all tests pass:
     ```bash
     npm run test --workspace=server
     npm run test --workspace=client
     ```
5. **PR Format**:
   - Keep commits concise and meaningful.
   - Follow the PR template: What changed, why it changed, and how it was verified.

## License
By contributing to QAZANPOS, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
