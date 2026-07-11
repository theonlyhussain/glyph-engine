import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import https from 'https';

async function downloadTestVideo() {
  if (fs.existsSync("test.mp4")) return;
  const file = fs.createWriteStream("test.mp4");
  return new Promise((resolve, reject) => {
    https.get("https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", response => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink("test.mp4", () => reject(err)); });
  });
}

(async () => {
  await downloadTestVideo();
  
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required'],
    headless: "new"
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  const allErrors = [];
  page.on('console', msg => {
    const t = msg.text();
    console.log(`[${msg.type().toUpperCase()}] ${t}`);
    if (msg.type() === 'error') allErrors.push(t);
  });
  page.on('pageerror', err => { console.log(`[PAGE_ERROR] ${err.message}`); allErrors.push(err.message); });

  console.log("=== TEST 1: First upload ===");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  const input1 = await page.$('input[type=file]');
  await input1.uploadFile(path.resolve('test.mp4'));
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'test1-first-upload.png' });
  console.log("Screenshot: test1-first-upload.png");
  
  console.log("\n=== TEST 2: Re-upload same video ===");
  const input2 = await page.$('input[type=file]');
  await input2.uploadFile(path.resolve('test.mp4'));
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'test2-reupload.png' });
  console.log("Screenshot: test2-reupload.png");
  
  console.log("\n=== FINAL RESULTS ===");
  const diag = await page.evaluate(() => {
    const items = document.querySelectorAll('[style*="1a1a2e"] div');
    return Array.from(items).map(d => d.textContent).join('\n');
  });
  console.log(diag);
  
  // Count real errors (ignore the initial importExternalTexture race)
  const realErrors = allErrors.filter(e => !e.includes("doesn't have back resource"));
  console.log("\nReal errors:", realErrors.length === 0 ? '✅ none' : realErrors);
  
  await browser.close();
})();
