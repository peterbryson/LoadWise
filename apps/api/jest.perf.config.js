/**
 * Opt-in performance measurements against a real local PostgreSQL (`pnpm perf:overview`).
 * Kept apart from jest.config.js so `pnpm test` and CI never run them.
 * @type {import('jest').Config}
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  roots: ['<rootDir>/perf'],
  testRegex: '.*\\.perf\\.ts$',
  collectCoverage: false,
  reporters: ['default'],
};
