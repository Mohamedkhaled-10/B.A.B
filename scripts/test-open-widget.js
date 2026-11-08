import { chromium } from 'playwright';

async function verifyAllPagesClickToOpen() {
  const browser = await chromium.launch({ headless: true });

  const testPages = [
    { name: 'Storefront Preview', url: 'http://localhost:3000/preview/index.html' },
    { name: 'Portal Home', url: 'http://localhost:3000/' }
  ];

  for (const t of testPages) {
    console.log(`\nTesting user interaction on ${t.name} (${t.url})...`);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(t.url, { waitUntil: 'networkidle' });

    // Click on the launcher button inside Shadow DOM
    const widget = page.locator('dandy-bab-widget');
    await widget.waitFor({ state: 'attached' });

    // Open widget by clicking launcher
    const launcher = widget.locator('#launcher-btn');
    await launcher.click();
    await page.waitForTimeout(300);

    const isOpen = await widget.evaluate(el => el.isOpen);
    console.log(`  Widget opened: ${isOpen}`);

    // Verify categories count and visibility inside Shadow DOM
    const data = await widget.evaluate(el => {
      const shadow = el.shadowRoot;
      const categories = shadow.querySelectorAll('.bab-category-card');
      const loading = shadow.querySelector('.bab-loading-container');
      const searchInput = shadow.querySelector('.bab-search-input');
      return {
        hasLoadingSpinner: !!loading,
        categoriesRendered: categories.length,
        categoryNames: Array.from(categories).map(c => c.querySelector('.bab-category-title')?.textContent?.trim()),
        searchPlaceholder: searchInput?.getAttribute('placeholder')
      };
    });

    console.log(`  State after opening:`, data);

    if (data.hasLoadingSpinner) {
      throw new Error(`FAILURE: Widget is showing loading spinner on ${t.name}!`);
    }
    if (data.categoriesRendered !== 8) {
      throw new Error(`FAILURE: Widget has ${data.categoriesRendered} categories instead of 8 on ${t.name}!`);
    }

    console.log(`  ✅ ${t.name} verified: all 8 categories rendered immediately with 0 loading hang!`);
    await page.close();
  }

  await browser.close();
  console.log('\n🎉 ALL PAGES VERIFIED SUCCESSFULLY!');
}

verifyAllPagesClickToOpen().catch(err => {
  console.error(err);
  process.exit(1);
});
