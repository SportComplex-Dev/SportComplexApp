import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const isCI = !!process.env.CI;
const systemChromium = "/usr/bin/chromium";
const hasSystemChromium = process.platform === "linux" && fs.existsSync(systemChromium);
const chromiumExecutable = process.env.CHROMIUM_PATH || (hasSystemChromium ? systemChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 30 * 1000,
  expect: {
    timeout: 8 * 1000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    headless: true,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutable
          ? {
              executablePath: chromiumExecutable,
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
              ],
            }
          : undefined,
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        launchOptions: chromiumExecutable
          ? {
              executablePath: chromiumExecutable,
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
              ],
            }
          : undefined,
      },
    },
  ],
  webServer: {
    command: "node -e 'const fs=require(\"fs\"); const t=\"apps/web/.next/standalone/apps/web\"; if(!fs.existsSync(t+\"/public\") && fs.existsSync(\"apps/web/public\")) { try { fs.symlinkSync(\"../../../../public\", t+\"/public\"); } catch {} } if(!fs.existsSync(t+\"/.next/static\") && fs.existsSync(\"apps/web/.next/static\")) { try { fs.symlinkSync(\"../../static\", t+\"/.next/static\"); } catch {} }' && PORT=3000 HOSTNAME=127.0.0.1 node apps/web/.next/standalone/apps/web/server.js",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 30 * 1000,
  },
});
