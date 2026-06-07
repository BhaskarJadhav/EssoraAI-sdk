import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/results.json" }]
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    slowMo: 0,
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen"
      ]
    }
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium"
      }
    }
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173/demo/",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_CLICKY_WORKER_BASE_URL:
        process.env.VITE_CLICKY_WORKER_BASE_URL ?? "https://round-voice-437d.essora-contactus.workers.dev"
    }
  }
});
