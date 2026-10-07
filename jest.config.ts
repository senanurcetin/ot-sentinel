import type { Config } from 'jest'
import nextJest from 'next/jest.js'
 
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})
 
// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  // App code only: shadcn primitives, Genkit CLI entry, config and generated files are excluded.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/components/ui/**',
    '!src/hooks/**',
    '!src/ai/dev.ts',
    '!src/ai/genkit.ts',
    '!src/lib/placeholder-images.ts',
    '!src/app/layout.tsx',
  ],
  testEnvironment: 'jest-environment-jsdom',
  // Add more setup options before each test is run
  // Measured at 99.9% lines / 97.6% branches / 91.9% functions when set; the floor sits below
  // that so ordinary refactors pass but dropping a whole test file does not.
  coverageThreshold: {
    global: { statements: 95, lines: 95, branches: 90, functions: 85 },
  },
  // Playwright specs live in tests/e2e and run with `npm run test:e2e`.
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide-react ships ESM for "import"; Jest needs the CommonJS build (real icons, no mock).
    '^lucide-react$': '<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js',
  },
}
 
// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
