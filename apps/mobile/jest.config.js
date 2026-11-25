/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.test\\.tsx?$',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: ['<rootDir>/src/jest-setup.ts'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports', outputName: 'junit-mobile.xml' }],
  ],
};
