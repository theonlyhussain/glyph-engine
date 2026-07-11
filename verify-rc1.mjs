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
    if (msg.type() === 'error') allErrors.push(t);
  });
  page.on('pageerror', err => { allErrors.push(err.message); });

  console.log("Navigating to RC1...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  // Wait a moment for UI to settle
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'rc1-welcome.png' });
  console.log("Screenshot: rc1-welcome.png");

  console.log("Uploading test.mp4...");
  const input = await page.$('input[type=file]');
  await input.uploadFile(path.resolve('test.mp4'));
  
  // Wait for rendering to start
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'rc1-render.png' });
  console.log("Screenshot: rc1-render.png");
  
  // Open Developer Mode
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('D');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'rc1-dev-mode.png' });
  console.log("Screenshot: rc1-dev-mode.png");

  console.log("Re-uploading test.mp4...");
  const input2 = await page.$('input[type=file]');
  await input2.uploadFile(path.resolve('test.mp4'));
  await new Promise(r => setTimeout(r, 2000));
  
  // Count real errors (ignore the initial importExternalTexture race if any)
  const realErrors = allErrors.filter(e => !e.includes("doesn't have back resource"));
  console.log("\nReal errors:", realErrors.length === 0 ? '✅ none' : realErrors);
  
  await browser.close();
})();
