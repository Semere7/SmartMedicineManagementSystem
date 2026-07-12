const puppeteer = require('puppeteer');

const BROWSER_URL = 'http://127.0.0.1:9222';
const PROJECT_URL_MATCH = '8XVYPMMFUnn';
const PROJECT_TITLE_MATCH = 'Smooth Lappi-Duup';

async function findProjectPage(pages) {
  for (const page of pages) {
    if (page.url().includes(PROJECT_URL_MATCH)) {
      return page;
    }
  }
  for (const page of pages) {
    const title = await page.title();
    if (title.includes(PROJECT_TITLE_MATCH)) {
      return page;
    }
  }
  return null;
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL,
    defaultViewport: null,
  });
  console.log(`[bridge] Connected to Chrome at ${BROWSER_URL}`);

  const pages = await browser.pages();
  console.log(`[bridge] Found ${pages.length} open tab(s):`);
  for (const [index, page] of pages.entries()) {
    const title = await page.title();
    console.log(`[bridge]   Tab ${index}: title="${title}" url=${page.url()}`);
  }

  const tinkercadPage = await findProjectPage(pages);

  if (!tinkercadPage) {
    console.log(`[bridge] No tab found matching url "${PROJECT_URL_MATCH}" or title "${PROJECT_TITLE_MATCH}".`);
  } else {
    const title = await tinkercadPage.title();
    console.log(`[bridge] Selected Tinkercad tab -> title="${title}" url=${tinkercadPage.url()}`);
  }

  browser.disconnect();
  console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
}

main().catch((error) => {
  console.error('[bridge] Failed:', error);
});
