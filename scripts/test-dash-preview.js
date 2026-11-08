import { chromium } from 'playwright';

async function testDashboardPreview() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log('DASH CONSOLE:', msg.text()));

  await page.goto('http://localhost:3000/dashboard/index.html', { waitUntil: 'networkidle' });

  // Click on "المعاينة الحية" tab
  console.log('Clicking on preview tab in dashboard...');
  await page.click('[data-dash-tab="preview"]');
  await page.waitForTimeout(500);

  const previewWidget = page.locator('dandy-bab-widget#dash-preview-widget');
  console.log('Preview widget attached:', await previewWidget.count());

  const state = await previewWidget.evaluate(el => {
    return {
      isOpen: el.isOpen,
      isLoading: el.isLoading,
      loadError: el.loadError,
      hasKnowledge: !!el.knowledge,
      categoriesCount: el.knowledge?.categories?.length || 0,
      shadowText: el.shadowRoot?.querySelector('.bab-content')?.textContent?.trim() || null,
      shadowInner: el.shadowRoot?.innerHTML?.substring(0, 1000)
    };
  });

  console.log('Preview Widget in Dashboard State:', state);

  await page.screenshot({ path: 'public/screenshots/dashboard-preview-tab.png' });
  console.log('Saved dashboard-preview-tab.png');

  await browser.close();
}

testDashboardPreview().catch(console.error);
