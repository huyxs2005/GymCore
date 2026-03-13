// @ts-check
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  outputDir: 'test-results/artifacts',
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit/results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Use PowerShell stop-parsing so Maven receives -D arguments correctly on Windows.
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -Command ".\\mvnw.cmd --% -q -Dmaven.test.skip=true spring-boot:run"',
      url: 'http://localhost:8080/api/v1/workouts',
      cwd: path.join(process.cwd(), 'backend'),
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -Command "npm.cmd run dev -- --host 127.0.0.1"',
      url: 'http://localhost:5173',
      cwd: path.join(process.cwd(), 'frontend'),
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
