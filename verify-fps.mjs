import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-webgpu'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173');
  
  console.log('Waiting for engine to initialize...');
  await new Promise(r => setTimeout(r, 2000));
  
  // Expose a function to evaluate FPS
  const fpsData = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      let lastTime = performance.now();
      
      const loop = () => {
        frames++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          resolve(frames);
        } else {
          requestAnimationFrame(loop);
        }
      };
      requestAnimationFrame(loop);
    });
  });
  
  console.log(`Measured FPS at default True Color density (4px): ${fpsData}`);
  
  // Clean up
  await browser.close();
  
  if (fpsData >= 50) {
    console.log('Performance is solid. Holds ~60 FPS.');
  } else {
    console.error('Performance degradation detected.');
  }
})();
