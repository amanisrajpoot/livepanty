const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.fill('input[name="display_name"]', 'Test User');
    await page.fill('input[name="username"]', `testuser${Date.now()}`);
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error')).toBeVisible();
  });
});

test.describe('KYC Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should navigate to KYC page and upload document', async ({ page }) => {
    await page.goto('/kyc');
    
    await expect(page.locator('h1')).toContainText('KYC Verification');
    
    // File upload would be tested here
    // await page.setInputFiles('input[type="file"]', 'path/to/document.jpg');
  });
});

test.describe('Streaming Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should create a stream', async ({ page }) => {
    await page.goto('/create-stream');
    
    await page.fill('input[name="title"]', 'Test Stream');
    await page.selectOption('select[name="category"]', 'music');
    await page.fill('textarea[name="description"]', 'Test description');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/stream\//);
  });

  test('should join a stream and send chat message', async ({ page }) => {
    // Assuming stream ID exists
    await page.goto('/stream/test-stream-id');
    
    await expect(page.locator('.stream-video')).toBeVisible();
    
    await page.fill('input[name="message"]', 'Hello, stream!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.chat-message').last()).toContainText('Hello, stream!');
  });
});

