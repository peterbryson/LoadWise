/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  // NFR 4: the analytics engine must keep at least 80% coverage. CI fails below this.
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports', outputName: 'junit-analytics.xml' }],
  ],
};
