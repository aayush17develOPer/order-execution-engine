module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/app.ts', // Exclude main entry point
    '!src/workers/**', // Exclude workers (integration tested via API)
    '!src/routes/**', // Exclude routes (integration tested via API)
    '!src/utils/logger.ts', // Exclude logger config
  ],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 65,
      lines: 50,
      statements: 50,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: false, // Turn off to avoid warning
  verbose: true,
};
