import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/preview/index.html',
    'http://localhost:3000/dashboard/index.html'
  ];

  for (const url of urls) {
    console.log(`\n========================================`);
    console.log(`🔍 Inspecting ${url}`);
    console.log(`========================================`);
    const page = await browser.newPage();

    const consoleLogs = [];
    const failedRequests = [];
    const networkRequests = [];

    page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('requestfailed', req => failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`));
    page.on('response', res => networkRequests.push(`${res.request().method()} ${res.url()} => ${res.status()}`));

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => console.error('Goto error:', e.message));
    await page.waitForTimeout(1000);

    console.log(`Network requests for ${url}:`);
    networkRequests.forEach(r => console.log('  ', r));

    if (failedRequests.length > 0) {
      console.log(`❌ Failed requests for ${url}:`);
      failedRequests.forEach(r => console.log('  ', r));
    }

    if (consoleLogs.length > 0) {
      console.log(`Console logs for ${url}:`);
      consoleLogs.forEach(c => console.log('  ', c));
    }

    // Check widget state if widget exists on page
    const widgets = await page.$$('dandy-bab-widget');
    console.log(`Found ${widgets.length} <dandy-bab-widget> element(s) on ${url}`);

    for (let i = 0; i < widgets.length; i++) {
      const state = await widgets[i].evaluate(el => {
        return {
          isOpen: el.isOpen,
          isLoading: el.isLoading,
          loadError: el.loadError,
          hasKnowledge: !!el.knowledge,
          categoriesCount: el.knowledge?.categories?.length || 0,
          currentView: el.currentView,
          shadowHTMLSnippet: el.shadowRoot?.innerHTML?.substring(0, 400)
        };
      });
      console.log(`Widget #${i + 1} State:`, state);
    }

    // Also check inside iframes if any
    const iframes = page.frames();
    console.log(`Page has ${iframes.length} frame(s)`);
    for (let f = 1; f < iframes.length; f++) {
      const frame = iframes[f];
      console.log(`Checking frame #${f}: ${frame.url()}`);
      try {
        const frameWidgets = await frame.$$('dandy-bab-widget');
        console.log(`  Found ${frameWidgets.length} widget(s) in frame`);
        for (let i = 0; i < frameWidgets.length; i++) {
          const state = await frameWidgets[i].evaluate(el => {
            return {
              isOpen: el.isOpen,
              isLoading: el.isLoading,
              loadError: el.loadError,
              hasKnowledge: !!el.knowledge,
              categoriesCount: el.knowledge?.categories?.length || 0,
              currentView: el.currentView,
              loadingText: el.shadowRoot?.querySelector('.bab-loading-text')?.textContent || null
            };
          });
          console.log(`  Frame Widget #${i + 1} State:`, state);
        }
      } catch (err) {
        console.log(`  Frame inspect error:`, err.message);
      }
    }

    await page.close();
  }

  await browser.close();
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
