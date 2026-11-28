/**
 * Opt-in tests against a real local PostgreSQL (`pnpm --filter @loadwise/api test:db`), for what
 * the fake-database specs cannot prove: foreign-key cascades, constraints and real queries.
 * Kept apart from jest.config.js because CI has no database service yet (issue log I-2).
 * @type {import('jest').Config}
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  roots: ['<rootDir>/integration'],
  testRegex: '.*\.int\.ts$',
  collectCoverage: false,
  reporters: ['default'],
};
