import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: ".venv/bin/python manage.py runserver 127.0.0.1:8000 --noreload",
      cwd: "../backend",
      url: "http://127.0.0.1:8000/api/health/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        THROTTLE_ANON: "5000/min",
        THROTTLE_USER: "5000/min",
        THROTTLE_AUTH: "1000/min",
        THROTTLE_UPLOAD: "1000/hour",
      },
    },
    {
      command: "npm run dev -- -p 3100",
      cwd: ".",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_BACKEND_ORIGIN: "http://127.0.0.1:8000" },
    },
  ],
});
