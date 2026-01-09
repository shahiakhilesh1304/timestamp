# GitHub Actions Workflows

Automated workflows catch issues early—every push and PR runs tests, type checks, linting, and builds before anything reaches production.

## 🔄 How It's Organized

GitHub Actions handles our CI/CD pipeline automatically based on repository events (pushes, PRs, schedules). The setup prioritizes security, so if you're extending these workflows, make sure to follow the same patterns.

## 📚 Useful Links

If you need more details on GitHub Actions:

- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Official guide
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions) - YAML reference
- [Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) - Security best practices

## 🚀 Our Workflows

### Core Workflows

#### [`ci-cd.yml`](ci-cd.yml)

This is the main pipeline that runs on every push and PR.

**What It Does:**
1. **Setup**: Installs Node.js (version from `.node-version`), runs `npm ci`, and caches dependencies
2. **Quality Checks**: ESLint, TypeScript type checking, unit tests (Vitest), E2E tests (Playwright)
3. **Build & Deploy**: Builds with Vite, deploys to production (main branch only)
4. **Lighthouse**: Captures performance metrics before/after deployment

**When It Runs:**
- Push to `main` → Full CI/CD + deployment + Lighthouse comparison
- PR to `main` → Full CI/CD (no deployment)

[![CI/CD](../../actions/workflows/ci-cd.yml/badge.svg)](../../actions/workflows/ci-cd.yml)

#### [`deploy-pages.yml`](deploy-pages.yml)

Emergency "break glass" deployment that bypasses CI/CD checks.

**Use when:**
- CI/CD is blocked but deployment is critical
- Quick hotfix deployment needed
- Testing deployment process itself

⚠️ **Requires typing "bypass-checks" to confirm** - This is intentional to prevent accidental use.

#### [`e2e.yml`](e2e.yml)

Reusable Playwright E2E test workflow. Called by `ci-cd.yml` and `pr-e2e-on-label.yml`.

### Issue & PR Automation

#### [`auto-label-issues.yml`](auto-label-issues.yml)

**Consolidated labelling workflow** - Automatically applies labels based on issue type:

| Issue Type | Labels Applied |
|------------|----------------|
| Bug reports | `theme/*`, `browser/*`, `os/*` |
| Feature requests | `feature/*` category labels |
| Theme suggestions | `help-wanted` when sharing ideas |

**Replaces**: Previously separate `label-bug.yml`, `label-feature-requests.yml`, `label-theme-suggestions.yml` workflows.

#### [`pr-e2e-on-label.yml`](pr-e2e-on-label.yml)

Runs E2E tests on PRs when the `e2e` label is added.

### Theme & Documentation Sync

#### [`sync-theme-metadata.yml`](sync-theme-metadata.yml)

**Consolidated sync workflow** - Keeps theme metadata in sync with `THEME_REGISTRY`:

- **Repository labels**: Creates `theme/*` labels so auto-labelling works
- **Issue templates**: Updates `bug_report.yml` theme dropdown
- **Theme READMEs**: Generates `src/themes/README.md` master listing and per-theme files

Triggers when `registry-core.ts` changes on main branch.

**Replaces**: Previously separate `sync-issue-templates.yml` and `sync-theme-readmes.yml` workflows.

#### [`theme-validation.yml`](theme-validation.yml)

Validates themes on pull requests:
- Configuration schema and exports
- Color contrast for accessibility
- Registry/config consistency

Runs when `src/themes/**` files are modified.

### Code Quality

#### [`dependency-review.yml`](dependency-review.yml)

Checks PRs for dependency vulnerabilities and license compatibility.

#### [`image-optimization.yml`](image-optimization.yml)

Automatically compresses images in pull requests using calibreapp/image-actions.

### Setup

#### [`copilot-setup-steps.yml`](copilot-setup-steps.yml)

Reusable setup steps for GitHub Copilot agent workflows.

## 🔒 Security Practices

We follow GitHub Actions security best practices:

### 1. SHA Pinning

All third-party actions are pinned to full commit SHAs instead of tags:

```yaml
# ✅ Secure - Pinned to immutable SHA
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# ❌ Insecure - Tag can be moved
- uses: actions/checkout@v4
```

**Why?** Tags can be moved or deleted, but commit SHAs are immutable. This prevents supply chain attacks.

[More on SHA pinning](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)

### 2. Minimal Permissions

Workflows start with minimal permissions and only elevate where needed:

```yaml
permissions:
  contents: read  # Read-only at workflow level
  
jobs:
  deploy:
    permissions:
      contents: read
      deployments: write  # Elevated only where needed
```

[More on permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)

### 3. Environment Variables for Secrets

Sensitive data always goes through environment variables to prevent script injection:

```yaml
# ✅ Safe - Environment variable
env:
  TITLE: ${{ github.event.pull_request.title }}
run: echo "$TITLE"

# ❌ Unsafe - Direct interpolation (script injection risk)
run: echo "${{ github.event.pull_request.title }}"
```

[More on script injection](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#understanding-the-risk-of-script-injections)

### 4. Dependabot Updates

We use Dependabot to automatically keep actions up to date:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

[More on Dependabot](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot)

## 🛠️ Project Commands Used

Our workflows use these npm scripts:

| Command | Purpose |
|---------|---------|
| `npm ci` | Clean install (faster, reproducible) |
| `npm run build` | Build with TypeScript + Vite |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests - fast mode (chromium, excludes @perf) |
| `npm run test:e2e:full` | E2E tests - complete suite (all browsers, @perf) |
| `npm run lint` | ESLint checking |

## 📊 Checking Workflow Status

### View Runs

1. Go to the [Actions tab](../../actions)
2. Pick a workflow from the sidebar
3. See recent runs and their status

### Debug a Failure

1. Click the failed run
2. Click the failed job
3. Expand steps to see logs

### Common Issues

| Issue | Solution |
|-------|----------|
| Test failures | Check logs for specific test errors |
| Build errors | Verify TypeScript types and imports |
| Lint errors | Run `npm run lint` locally to see issues |
| Deploy failures | Check permissions and secrets |

## ✍️ Adding New Workflows

### Basic Workflow Template

```yaml
name: My Workflow

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  my-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      - run: npm run test
```

### Before You Start

1. Check if you can extend an existing workflow instead
2. Figure out when it should run (triggers)
3. Decide what permissions it needs
4. Test commands locally first
5. Pin all third-party actions to SHAs

### Tips

- Use clear names for jobs and steps
- Pin actions to commit SHAs
- Start with minimal permissions
- Cache dependencies for speed
- Use `if` conditions to skip unnecessary work
- Reference Node version from `.node-version`
- Add status badges to README

## 🎯 Common Patterns

### Conditional Deployment

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    steps:
      - run: npm run deploy
```

### Matrix Testing

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### Reusable Workflows

```yaml
# .github/workflows/reusable.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to ${{ inputs.environment }}"

# .github/workflows/main.yml
jobs:
  call-reusable:
    uses: ./.github/workflows/reusable.yml
    with:
      environment: production
```

[More on reusable workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)

## 📏 Conventions

We follow these conventions:

### File Naming

Use kebab-case with `.yml` suffix:
- `ci-cd.yml`
- `deploy-production.yml`
- `security-scan.yml`

### Structure

1. **Name** - Descriptive workflow name
2. **Triggers** - When to run
3. **Permissions** - Minimal required access
4. **Jobs** - Logical groupings of steps
5. **Steps** - Individual actions

### Comments

```yaml
# Pin to SHA for security - version v4.2.2
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
```

## 🔗 See Also

- [Custom Instructions](../instructions/README.md) - Includes GitHub Actions standards
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions) - Browse available actions
- [GitHub Actions Guides](https://docs.github.com/en/actions/learn-github-actions) - Official learning resources
- [Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) - Security deep dive
- [OpenSSF Best Practices](https://www.bestpractices.dev/en) - Security standards
