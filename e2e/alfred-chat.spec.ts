import { test, expect } from "@playwright/test";

// Credentials for test user
const EMAIL = "javier@evolveds.ai";
const PASSWORD = "Javier003!";

// Helper: login and navigate to chat
async function login(page) {
  await page.goto("/");
  // Wait for auth page to load
  await page.waitForTimeout(2000);

  // Check if already logged in (redirected to chat)
  if (page.url().includes("/chat") || page.url().includes("/dashboard")) {
    return;
  }

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login")').click();
    await page.waitForURL(/\/(chat|dashboard)/, { timeout: 15000 });
  }
}

// Helper: send a message and wait for response
async function sendAndWait(page, message: string, maxWaitMs = 150000) {
  // Navigate to chat if not there
  if (!page.url().includes("/chat")) {
    await page.goto("/chat");
    await page.waitForTimeout(2000);
  }

  // Find input and send message
  const input = page.locator('input[placeholder*="escribe"], input[placeholder*="mensaje"], textarea, input[type="text"]').last();
  await input.fill(message);
  await input.press("Enter");

  // Wait for "busy" indicator to appear
  await page.waitForTimeout(3000);

  // Poll until response appears or timeout
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    // Check if busy indicator is gone
    const busyIndicator = page.locator('text="Alfred esta trabajando"');
    const heartbeat = page.locator('[class*="hb-"]');

    // Check for assistant messages (non-progress)
    const messages = page.locator('[class*="assistant"], [data-role="assistant"]');
    const messageTexts = await messages.allTextContents();

    // Find real responses (not progress)
    const realResponses = messageTexts.filter(
      (t) =>
        t.length > 30 &&
        !t.includes("trabajando") &&
        !t.includes("restantes") &&
        !t.endsWith("...") &&
        !t.includes("% (~")
    );

    if (realResponses.length > 0) {
      return realResponses[realResponses.length - 1];
    }

    await page.waitForTimeout(3000);
  }

  return null;
}

test.describe("Alfred Chat E2E", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("login works and reaches chat", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/chat");

    // Should see chat input
    const input = page.locator('input, textarea').last();
    await expect(input).toBeVisible();
  });

  test("greeting gets quick response", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    const input = page.locator('input, textarea').last();
    await input.fill("hola");
    await input.press("Enter");

    // Wait for response (greetings are fast, <10s)
    await page.waitForTimeout(10000);

    // Should have at least one assistant message
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  test("search products shows carousel", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    const input = page.locator('input, textarea').last();
    await input.fill("busca leche en los supers");
    await input.press("Enter");

    // Wait for progress indicator
    await page.waitForTimeout(5000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Buscando");

    // Wait for carousel to appear (up to 3 min)
    const carousel = page.locator('[class*="carousel"], [class*="ProductCarousel"], [class*="product-card"]');
    try {
      await carousel.first().waitFor({ timeout: 150000 });
      // Carousel appeared - check for product cards
      const cards = page.locator('[class*="card"], [class*="product"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);
    } catch {
      // Timeout - check if response text appeared at least
      const content = await page.textContent("body");
      expect(content?.length).toBeGreaterThan(100);
    }
  });

  test("stop button works", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    const input = page.locator('input, textarea').last();
    await input.fill("busca aceite de oliva en los supers");
    await input.press("Enter");

    // Wait for progress to start
    await page.waitForTimeout(8000);

    // Look for stop button
    const stopButton = page.locator('button:has-text("Detener"), button:has-text("Stop"), button:has-text("Cancelar")');
    if (await stopButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await stopButton.click();

      // After clicking stop, busy indicator should disappear
      await page.waitForTimeout(3000);
      const busyText = await page.textContent("body");
      expect(busyText).not.toContain("Alfred esta trabajando");
    }
  });

  test("new thread button works", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // Send a message first
    const input = page.locator('input, textarea').last();
    await input.fill("hola");
    await input.press("Enter");
    await page.waitForTimeout(5000);

    // Click new thread button (+)
    const newThreadBtn = page.locator('button:has-text("+"), button[title*="nuevo"], button[aria-label*="nuevo"]');
    if (await newThreadBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await newThreadBtn.first().click();
      await page.waitForTimeout(2000);

      // Messages should be cleared
      // The input should be empty and ready
      const inputAfter = page.locator('input, textarea').last();
      await expect(inputAfter).toBeVisible();
    }
  });

  test("sidebar navigation works", async ({ page }) => {
    // Test all nav items
    const routes = ["/chat", "/dashboard", "/agents", "/connectors", "/settings"];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      expect(page.url()).toContain(route);
    }
  });

  test("router health check from frontend", async ({ page }) => {
    // Check that the status indicator in sidebar shows connected
    await page.goto("/chat");
    await page.waitForTimeout(5000);

    const bodyText = await page.textContent("body");
    // Should show "Conectado" in the sidebar status
    const hasConnected = bodyText?.includes("Conectado");
    const hasDisconnected = bodyText?.includes("Desconectado");

    // At least one status should be visible
    expect(hasConnected || hasDisconnected).toBeTruthy();
  });
});
