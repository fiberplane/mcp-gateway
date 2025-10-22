# Contributing to MCP Gateway

Thank you for your interest in contributing to MCP Gateway! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- **Bun 1.0+** - [Install Bun](https://bun.sh)
- **Git** - For version control
- **Node.js 18+** - For compatibility (Bun is recommended)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/fiberplane/mcp-gateway.git
   cd mcp-gateway
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Verify setup**
   ```bash
   bun run typecheck
   bun run build
   bun run dev
   ```

See [Development Setup](./docs/development/setup.md) for detailed instructions.

## Development Workflow

### Understanding the Codebase

MCP Gateway is a **Bun workspace monorepo**. See [Architecture](./docs/architecture/overview.md) for system design and [Monorepo Structure](./docs/development/monorepo-structure.md) for package organization.

### Running Locally

```bash
# Start in development mode
bun run dev

# This launches:
# - Web UI at http://localhost:3333/ui
# - TUI in the same terminal
# - REST API at http://localhost:3333/api

# In another terminal, run test MCP server:
bun run --filter test-mcp-server dev
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Follow code style guidelines (see below)
   - Add tests for new functionality
   - Update documentation

3. **Verify your changes**
   ```bash
   bun run typecheck    # Type checking
   bun run lint         # Linting
   bun run format       # Code formatting
   bun run build        # Build all packages
   bun run test         # Run tests
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat: descriptive message"
   ```
   See [Commit Messages](#commit-messages) for guidelines.

5. **Push and create a PR**
   ```bash
   git push origin feat/your-feature-name
   ```

## Code Style & Standards

### TypeScript

- **Strict mode enabled** - All files must pass `bun run typecheck`
- **ESLint** configured via Biome
- **Formatting** via Biome (`bun run format`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance

**Examples**:
```
feat(api): add query filtering by server name

Allow filtering logs by server name in the query API.
Adds new filter parameter to LogQueryOptions.

Closes #123
```

```
fix(core): invalidate cache on log writes

Cache was becoming stale because metrics depend on logs
but cache was only invalidated on server registry changes.

Fixes #456
```

### Code Guidelines

1. **Files**
   - Use `.ts` for TypeScript
   - Use `.tsx` for React components
   - Organize by feature/domain

2. **Naming**
   - `camelCase` for variables, functions, properties
   - `PascalCase` for classes, types, interfaces
   - `CONSTANT_CASE` for constants

3. **Imports**
   - Use absolute imports from package boundaries
   - Group imports: stdlib → packages → local
   - Use `import type` for types

4. **Comments**
   - Use JSDoc for public APIs
   - Keep comments up-to-date
   - Explain "why", not "what"

### Example Code Structure

```typescript
import { type Gateway } from "@fiberplane/mcp-gateway-types";
import { logger } from "./logger.js";

/**
 * Do something important
 *
 * @param gateway - Gateway instance for storage access
 * @param serverName - Name of the server
 * @returns Promise resolving to the result
 */
export async function doSomething(
  gateway: Gateway,
  serverName: string,
): Promise<Result> {
  // Implementation
}
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test packages/core/src/__tests__/example.test.ts

# Run with watch mode
bun test --watch

# Check coverage
bun test --coverage
```

### Writing Tests

1. **Test file location**: Same directory as source, `.test.ts` suffix
2. **Test structure**: Use `describe()` and `it()` blocks
3. **Assertions**: Use `expect()` from test framework
4. **Mocking**: Use mocks for external dependencies

### Test Coverage

- **Target**: 80%+ coverage
- **Critical paths**: 100% coverage
- **Utils**: Can be lower if simple

## Pull Request Process

### Before Opening PR

- [ ] Tests pass: `bun run test`
- [ ] Types pass: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] Formatting passes: `bun run format`
- [ ] Build succeeds: `bun run build`
- [ ] Changes tested manually
- [ ] Documentation updated

### Opening a PR

1. **Push your branch**
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create PR on GitHub**
   - Use the PR template
   - Reference related issues
   - Describe changes and rationale
   - Add screenshots for UI changes

3. **PR Description Format**
   ```markdown
   ## Summary
   Brief description of changes

   ## Type of Change
   - [ ] New feature
   - [ ] Bug fix
   - [ ] Refactoring
   - [ ] Documentation

   ## Test Plan
   How to test these changes:
   1. Step 1
   2. Step 2
   3. Verify expected behavior

   ## Checklist
   - [ ] Tests pass
   - [ ] Types pass
   - [ ] Documentation updated
   ```

### Review Process

- At least one approval required
- All CI checks must pass
- Address review feedback
- Keep commits clean and logical

## Documentation

### Code Documentation

- **Public APIs**: Include JSDoc comments
- **Complex logic**: Add inline comments
- **Examples**: Provide usage examples

### User Documentation

- Update relevant `.md` files in `docs/`
- Add screenshots for UI changes
- Update API documentation
- Add to changelog if needed

### Documentation Format

```markdown
# Title

## Overview
High-level description

## Usage
```bash
code example
```

## Examples
Real-world examples

## See Also
- Related doc link
```

## Areas for Contribution

### High Priority

- [ ] Missing user documentation
- [ ] Test coverage gaps
- [ ] Security hardening
- [ ] Performance optimization
- [ ] UI/UX improvements

### Medium Priority

- [ ] Code quality improvements
- [ ] Error handling enhancement
- [ ] Additional API endpoints
- [ ] CLI feature additions
- [ ] Documentation improvements

### Low Priority

- [ ] Code style improvements
- [ ] Dependency updates
- [ ] Refactoring
- [ ] Example code

## Project Structure

Key directories to understand:

```
packages/
├── types/                 # Type definitions
├── core/                  # Core business logic
├── api/                   # REST API
├── server/                # MCP protocol server
├── web/                   # React web UI
├── mcp-gateway/           # CLI (private)
└── cli/                   # Public wrapper

docs/
├── architecture/          # System design
├── user-guide/           # User documentation
├── api/                  # API documentation
├── development/          # Developer guides
└── deployment/           # Deployment guides
```

See [Monorepo Structure](./docs/development/monorepo-structure.md) for details.

## Building & Deployment

### Local Build

```bash
bun run build
```

### Binary Build

```bash
# Build binary for current platform
bun run build:binaries

# Build for all platforms (requires Docker)
bun run build:binaries --all
```

## Common Tasks

### Add a New Dependency

```bash
# Add to package
cd packages/my-package
bun add some-package

# Add dev dependency to root
cd ../..
bun add -D some-dev-package
```

### Add a New Package

See [Adding Packages](./docs/development/adding-packages.md).

### Update Type Definitions

Type definitions are in `packages/types/`. Update when changing interfaces:

```bash
# Update type definitions
# Then rebuild
bun run build
```

### Debug

```bash
# Enable debug logging
DEBUG=* bun run dev

# Debug in VS Code
# See launch.json configuration
```

## Security

For security issues, see [SECURITY.md](./SECURITY.md).

**Do not open public issues for security vulnerabilities.**

## Code of Conduct

- Be respectful to all contributors
- Give constructive feedback
- Welcome diverse perspectives
- Report harassment to maintainers

## Frequently Asked Questions

### How long do reviews take?
Usually 24-48 hours on weekdays, longer on weekends.

### Can I work on an issue that's already assigned?
Contact the assignee first. If unresponsive, reach out to maintainers.

### Do I need to sign a CLA?
Not currently, but future contributions may require one.

### Can I contribute from outside the core team?
Absolutely! External contributions are welcome.

### How do I become a maintainer?
Make consistent, high-quality contributions and discuss with existing maintainers.

## Resources

- **[Architecture Documentation](./docs/architecture/overview.md)** - System design
- **[Development Setup](./docs/development/setup.md)** - Detailed setup instructions
- **[Monorepo Structure](./docs/development/monorepo-structure.md)** - Package organization
- **[API Specification](./docs/api/specification.md)** - API endpoints
- **[Deployment Guide](./docs/deployment/binary-distribution.md)** - How binaries work

## Questions?

- Check [FAQ](./docs/user-guide/faq.md)
- Search [existing issues](https://github.com/fiberplane/mcp-gateway/issues)
- Open [new discussion](https://github.com/fiberplane/mcp-gateway/discussions)
- Email: hello@fiberplane.com

---

**Thank you for contributing to MCP Gateway!** 🎉

Your contributions make this project better for everyone.
