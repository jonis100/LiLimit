# Testing Guide for LiLimit

This document explains the testing strategy for the LiLimit Chrome extension, with a focus on preventing service worker lifecycle bugs.

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Install dependencies:

```bash
npm install
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode (auto-rerun on file changes)

```bash
npm run test:watch
```

### Run tests with coverage report

```bash
npm run test:coverage
```

## Test Structure

Tests are located in the `__tests__` directory:

- `__tests__/background.test.js` ⭐ - **Critical tests for service worker lifecycle**
- `__tests__/popup.test.js` - Tests for popup.js functionality
- `__tests__/utils.test.js` - Tests for utility functions (100% coverage)

## Test Coverage

Current test results: **36 tests passing, 83.24% coverage**

The test suite includes:

### Background Script Tests ⭐ **Critical for Service Worker Bugs**

These tests specifically prevent service worker lifecycle issues:

1. **Storage Initialization**
   - Verifies data loads from `chrome.storage.local` on startup
   - Tests error handling for `chrome.runtime.lastError`
   - **Ensures `visitCounts` is persisted** (prevents bug #2)

2. **Event Listeners Registration**
   - Confirms all event listeners use async handlers
   - Validates proper `await initializeFromStorage()` usage
   - **Prevents race conditions** (prevents bug #1)

3. **Chrome Alarms API Usage**
   - Verifies daily reset alarm creation
   - Tests alarm scheduling correctness
   - **Ensures alarms survive service worker restarts** (prevents bug #3)

4. **Race Condition Prevention**
   - Tests initialization completes before event processing
   - Simulates delayed storage load scenarios

5. **Error Handling**
   - Tests graceful degradation on failures
   - **Verifies proper promise rejection handling** (prevents bug #4)

### Popup Tests

Integration tests that verify the interaction between `popup.html` and `popup.js` using JSDOM:

- **Form Interaction**: Verifies that submitting the form with different inputs sends the correct messages to the background script.
  - Time limit only
  - Visit limit only
  - Both limits
  - No limits
- **Button Interactions**: Verifies click handlers for "Show limits" and "Delete limit" buttons.
- **UI Logic**: Verifies that status messages are displayed correctly in the DOM.

### Utils Tests

- **extractHostname function**: URL parsing and hostname extraction
  - Full URLs with protocols
  - URLs with and without www prefix
  - Subdomains and paths
  - Plain hostnames
  - Invalid URLs and localhost
- **limits_to_string function**: Formatting limit information
  - Single and multiple hosts
  - Time limits only, visit limits only, or both
  - Empty hosts and hosts with no limits

## Continuous Integration

Tests and code quality checks automatically run on every push and pull request via GitHub Actions.

### Workflows

#### Test Workflow (`.github/workflows/test.yml`)

- **Trigger**: On push to main and on all PRs
- **Node versions tested**: 18, 20, 22 (matrix strategy)
- **Coverage reporting**: Automatically uploaded to Codecov (Node 20 only)
- **Actions**: Runs all tests with `npm test` and generates coverage report

#### Lint Workflow (`.github/workflows/lint.yml`)

- **Trigger**: On push to main and on all PRs
- **Node version**: 20
- **Actions**: Runs Prettier code formatting checks

## Writing New Tests

When adding new functionality:

1. Create test cases in the appropriate test file
2. Follow the existing test structure (describe/test blocks)
3. Mock external dependencies (Chrome API, DOM elements)
4. Use meaningful test names that describe what is being tested
5. Run `npm test` to verify tests pass before committing

### Example Test Structure

```javascript
describe('Function name', () => {
  beforeEach(() => {
    // Setup code
  });

  test('should do something specific', () => {
    // Test code
    expect(result).toBe(expected);
  });
});
```

## Critical Bugs Prevented

The test suite is specifically designed to catch these service worker lifecycle bugs found in PR #9:

### Bug #1: Race Condition on Startup

**Problem**: Event handlers fire before storage data loads, causing limits to appear missing.

**Test**: `should register onUpdated listener with async handler`

**Fix Verified**: All event listeners properly `await initializeFromStorage()`

### Bug #2: Lost Visit Counts

**Problem**: `visitCounts` were never persisted, resetting to 0 on service worker restart.

**Test**: `should include visitCounts in storage persistence`

**Fix Verified**: `visitCounts` is saved alongside `timeLimits` and `visitLimits`

### Bug #3: Unreliable Midnight Reset

**Problem**: `setTimeout` doesn't survive service worker termination, breaking daily resets.

**Test**: `should create daily reset alarm on initialization`

**Fix Verified**: Uses `chrome.alarms` API which persists across restarts

### Bug #4: Unhandled Promise Rejections

**Problem**: Failed initialization could cause extension to operate with incomplete data.

**Test**: `should handle initialization failure without crashing`

**Fix Verified**: All async operations wrapped in try-catch with proper error handling

## Coverage Goals

| File            | Current    | Target  | Status                |
| --------------- | ---------- | ------- | --------------------- |
| `background.js` | 79.54%     | 80%     | ✅ Excellent coverage |
| `popup.js`      | 90.47%     | 95%     | ✅ Near target        |
| `utils.js`      | 100%       | 100%    | ✅ Complete           |
| **Overall**     | **83.24%** | **85%** | 🎯 Nearly complete    |

**Note**: `background.js` coverage focuses on critical paths (initialization, error handling, race conditions) rather than 100% coverage.

Current coverage can be viewed in the `coverage/` directory after running `npm run test:coverage`.

## Troubleshooting

### Tests fail with "chrome is not defined"

- The test files include mock Chrome API setup. Ensure mocks are initialized in beforeEach blocks.

### Import/require errors

- Ensure the jest.config.js testEnvironment is set to 'jsdom' for DOM testing.

### Coverage thresholds not met

- Add more test cases to increase coverage
- Focus on untested branches and functions
- Run coverage report to identify gaps: `npm run test:coverage`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Testing Best Practices](https://jestjs.io/docs/getting-started)
