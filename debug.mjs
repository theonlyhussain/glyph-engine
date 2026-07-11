import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({ 
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE_ERROR] ${error.message}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`[NETWORK_FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  console.log("Navigating to localhost:5173...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' }).catch(e => console.log("Navigation Error:", e));
  
  // Wait to see if React renders anything
  await new Promise(r => setTimeout(r, 2000));
  
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'ROOT_NOT_FOUND';
  });
  
  console.log("[ROOT_HTML_PREVIEW]");
  console.log(rootHtml.substring(0, 500));
  
  await browser.close();
})();
