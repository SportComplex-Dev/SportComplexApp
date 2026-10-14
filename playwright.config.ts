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
  workers: 1,
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
        launchOptions: {
          ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        launchOptions: {
          ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "node -e 'const fs=require(\"fs\"),path=require(\"path\"); const t=path.resolve(\"apps/web/.next/standalone/apps/web\"); try{fs.unlinkSync(path.join(t,\".next/static\"))}catch{} try{fs.unlinkSync(path.join(t,\"public\"))}catch{} if(fs.existsSync(\"apps/web/.next/static\")) fs.symlinkSync(path.resolve(\"apps/web/.next/static\"), path.join(t,\".next/static\")); if(fs.existsSync(\"apps/web/public\")) fs.symlinkSync(path.resolve(\"apps/web/public\"), path.join(t,\"public\"));' && PORT=3000 HOSTNAME=127.0.0.1 node apps/web/.next/standalone/apps/web/server.js",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
});
