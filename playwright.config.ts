import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000, // 3 min per test (agents are slow)
  retries: 0,
  use: {
    baseURL: "https://alfred-frontend.vercel.app",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
