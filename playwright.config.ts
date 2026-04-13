import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "html",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
