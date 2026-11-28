/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.test\\.tsx?$',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Jest resolves lucide-react-native to its ES module build, which it cannot load. Its own
    // CommonJS build is used instead (#52); the app bundle (Metro) is unaffected.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/jest-setup.ts'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports', outputName: 'junit-mobile.xml' }],
  ],
};
