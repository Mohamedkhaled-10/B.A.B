import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function runVerification() {
  console.log('🚀 Starting Playwright Browser Verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.resolve('public/screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Desktop Test (1440x900) on Preview Storefront
  console.log('📱 Testing Desktop View (1440x900) on /preview/index.html...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:3000/preview/index.html', { waitUntil: 'networkidle' });

  // Open the widget if not opened
  const widget = desktopPage.locator('dandy-bab-widget');
  await widget.waitFor({ state: 'attached' });

  // Evaluate inside Shadow Root
  const headerAudit = await widget.evaluate((el) => {
    const shadow = el.shadowRoot;
    if (!shadow) return { error: 'No shadowRoot' };

    // Open widget
    el.toggleWidget(true);

    const logo = shadow.querySelector('.bab-header-logo-img');
    const tagline = shadow.querySelector('.bab-header-tagline');
    const forbiddenElements = {
      brandTitle: !!shadow.querySelector('.bab-brand-title'),
      brandBadge: !!shadow.querySelector('.bab-brand-badge'),
      onlineDot: !!shadow.querySelector('.bab-online-dot'),
      welcomeCard: !!shadow.querySelector('.bab-welcome-card')
    };

    const searchInput = shadow.querySelector('.bab-search-input');
    const categories = shadow.querySelectorAll('.bab-category-card');
    const categoryTitles = Array.from(categories).map(c => c.querySelector('.bab-category-title')?.textContent?.trim());

    return {
      isOpen: el.isOpen,
      logoSrc: logo?.src || null,
      taglineText: tagline?.textContent?.trim() || null,
      forbiddenElements,
      searchPlaceholder: searchInput?.getAttribute('placeholder') || null,
      categoriesCount: categories.length,
      categoryTitles
    };
  });

  console.log('Desktop Header & Structure Audit Result:', JSON.stringify(headerAudit, null, 2));

  // Let render settle and take desktop screenshot
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: path.join(outputDir, 'desktop-widget-open.png'), fullPage: false });
  console.log('📸 Saved desktop screenshot to public/screenshots/desktop-widget-open.png');

  // Test Search on desktop
  await widget.evaluate((el) => {
    el.searchQuery = 'الشحن';
    el.handleSearchInput({ target: { value: 'الشحن' } });
    el.executeSearch();
  });
  await desktopPage.waitForTimeout(400);
  await desktopPage.screenshot({ path: path.join(outputDir, 'desktop-search-results.png'), fullPage: false });

  // 2. Mobile Test (390x844 - iPhone 14 / modern phone standard)
  console.log('📱 Testing Mobile View (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/preview/index.html', { waitUntil: 'networkidle' });

  const mobileWidget = mobilePage.locator('dandy-bab-widget');
  await mobileWidget.waitFor({ state: 'attached' });

  // Open mobile widget
  await mobileWidget.evaluate((el) => {
    el.navigateHome();
    el.toggleWidget(true);
  });
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(outputDir, 'mobile-home.png'), fullPage: false });
  console.log('📸 Saved mobile screenshot to public/screenshots/mobile-home.png');

  // Navigate to Article on Mobile
  await mobileWidget.evaluate((el) => {
    el.navigateTo('article', null, 'shipping-delivery-time');
  });
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(outputDir, 'mobile-article-view.png'), fullPage: false });
  console.log('📸 Saved mobile article screenshot to public/screenshots/mobile-article-view.png');

  // Test Loading state display explicitly
  await mobileWidget.evaluate((el) => {
    el.isLoading = true;
    el.render();
  });
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: path.join(outputDir, 'mobile-loading-state.png'), fullPage: false });
  console.log('📸 Saved loading state screenshot to public/screenshots/mobile-loading-state.png');

  // Restore widget
  await mobileWidget.evaluate((el) => {
    el.isLoading = false;
    el.navigateHome();
  });

  await browser.close();
  console.log('✅ Playwright browser verification completed successfully!');
}

runVerification().catch((err) => {
  console.error('❌ Playwright verification failed:', err);
  process.exit(1);
});
