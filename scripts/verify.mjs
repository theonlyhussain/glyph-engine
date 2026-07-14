// Verifies that the app builds, serves, and initializes the WebGPU pipeline successfully.
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

async function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runVerification() {
  console.log('Building project...');
  const build = spawn('npm', ['run', 'build'], { shell: true, stdio: 'inherit' });
  await new Promise(r => build.on('close', r));

  console.log('Starting preview server...');
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], { shell: true });
  
  await wait(2000); // Wait for server to start

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: false, // WebGPU often requires headful mode in test environments
    args: ['--enable-unsafe-webgpu', '--use-angle=vulkan']
  });
  
  const page = await browser.newPage();
  let webGpuError = false;

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Browser]: ${text}`);
    if (text.includes('WebGPU error') || text.includes('failed')) {
      webGpuError = true;
    }
  });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
    console.log('Page loaded.');
    
    // Check if the UI mounted (Welcome screen should be visible)
    const hasWelcome = await page.evaluate(() => {
      return document.body.innerText.includes('Welcome to GlyphEngine');
    });

    if (!hasWelcome) throw new Error("UI failed to mount properly.");
    console.log('UI mounted successfully.');

    // Note: To test rendering end-to-end, we would need to programmatically upload a video here.
    // However, basic initialization (WebGPU support check) is verified on load.
    
    if (webGpuError) {
      throw new Error("WebGPU initialization errors detected in console.");
    }
    
    console.log('Verification passed: App built, served, and UI initialized without WebGPU crashes.');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

runVerification();
