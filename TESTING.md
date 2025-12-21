# Testing Guide for LiLimit

This document explains how to run and write tests for the LiLimit Chrome extension.

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

- `__tests__/background.test.js` - Tests for background.js functionality
- `__tests__/popup.test.js` - Tests for popup.js functionality
- `__tests__/utils.test.js` - Tests for utility functions

## Test Coverage

The test suite includes:

### Background Tests
- **Chrome API mocks**: Verification of listener setup for runtime, tabs, and storage APIs
- **Message handlers**: Testing chrome.runtime.onMessage listeners
- **Tab event handlers**: Testing chrome.tabs.onUpdated and onActivated listeners
- **Storage API**: Testing chrome.storage.local.get and set functionality

### Popup Tests
- **limitTime function**: Time limit message sending
- **limitVisit function**: Visit limit message sending
- **Form submission**: Various submission scenarios (time only, visit only, both, none)
- **showMessage function**: UI message display and handling
- **Button event listeners**: ShowLimits and DeleteLimits button functionality
- **DOM elements**: Presence and correctness of UI elements (form, inputs, message)

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

Tests automatically run on every pull request to the `main` branch via GitHub Actions.

### Workflow Details
- **Trigger**: On push to main and on all PRs
- **Node versions tested**: 16.x, 18.x, 20.x
- **Coverage reporting**: Automatically uploaded to Codecov

See `.github/workflows/run-tests.yml` for complete workflow configuration.

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

## Coverage Goals

The project has the following coverage thresholds:
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

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
