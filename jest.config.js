export default {
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    '*.js',
    '!jest.config.js',
    '!node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  verbose: true,
};
