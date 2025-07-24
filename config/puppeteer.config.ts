export interface PuppeteerConfig {
  headless: boolean;
  defaultViewport: {
    width: number;
    height: number;
  };
  args: string[];
  timeout: number;
  userAgent: string;
  slowMo: number;
}

export const puppeteerConfig: PuppeteerConfig = {
  headless: process.env.PUPPETEER_HEADLESS !== 'false',
  defaultViewport: {
    width: parseInt(process.env.PUPPETEER_WIDTH || '1366'),
    height: parseInt(process.env.PUPPETEER_HEIGHT || '768')
  },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ],
  timeout: parseInt(process.env.PUPPETEER_TIMEOUT || '30000'),
  userAgent: process.env.PUPPETEER_USER_AGENT || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  slowMo: parseInt(process.env.PUPPETEER_SLOW_MO || '0')
};
