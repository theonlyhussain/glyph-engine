import puppeteer from 'puppeteer';
import fs from 'fs';
import https from 'https';
import path from 'path';

async function downloadTestVideo() {
  const file = fs.createWriteStream("test.mp4");
  return new Promise((resolve, reject) => {
    https.get("https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink("test.mp4", () => reject(err));
    });
  });
}

(async () => {
  console.log("Downloading test video...");
  if (!fs.existsSync("test.mp4")) {
    await downloadTestVideo();
  }
  
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
    headless: "new"
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
  });

  console.log("Navigating to localhost:5173...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  console.log("Uploading file...");
  const inputUploadHandle = await page.$('input[type=file]');
  await inputUploadHandle.uploadFile(path.resolve('test.mp4'));
  
  console.log("Waiting for video to play...");
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Reading Cell Data...");
  const cellData = await page.evaluate(async () => {
    return Array.from(await window.engine.renderer.readCellData());
  });
  
  console.log("Cell Data Sample (First Cell):");
  console.log("Color:", cellData.slice(0, 4));
  console.log("State:", cellData.slice(4, 8));

  let nonZeroCount = 0;
  for (let i = 0; i < cellData.length; i++) {
     if (cellData[i] > 0) nonZeroCount++;
  }
  console.log("Non-zero values in sample:", nonZeroCount);
  await page.screenshot({ path: 'render-test.png' });

  await browser.close();
  console.log("Done");
})();
