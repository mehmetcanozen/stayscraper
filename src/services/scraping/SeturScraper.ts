import puppeteer from 'puppeteer-extra';
import type { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs/promises';
import * as path from 'path';

puppeteer.use(StealthPlugin());

export interface SeturScrapeParams {
  hotelSlug: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  childBirthdates?: string[]; // YYYY-MM-DD[]
  userAgent?: string;
  headless?: boolean;
}

export interface SeturRoomData {
  name: string;
  price: string;
  roomType?: string;
  boardType?: string;
  capacity?: string;
}

export class SeturScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', headless: boolean = false) {
    console.log(`Initializing SeturScraper in ${headless ? 'headless' : 'non-headless'} mode`);
    
    // For Setur, we'll use non-headless by default to avoid detection
    const launchOptions = {
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-ipc-flooding-protection',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--user-agent=' + userAgent
      ],
      defaultViewport: headless ? { width: 1920, height: 1080 } : null,
    };
    
    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();
    
    // Set user agent and viewport
    await this.page.setUserAgent(userAgent);
    if (headless) {
      await this.page.setViewport({ width: 1920, height: 1080 });
    }
    
    // Set extra headers for better stealth
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.setur.com.tr/'
    });

    // Advanced stealth measures
    await this.page.evaluateOnNewDocument(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
      
      // Override chrome runtime
      (window as any).chrome = {
        runtime: {},
      };
      
      // Remove automation indicators
      delete (window as any).navigator.__proto__.webdriver;
      
      // Override permissions
      const originalQuery2 = (window.navigator as any).permissions?.query;
      (window.navigator as any).permissions = {
        ...(window.navigator as any).permissions,
        query: (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery2(parameters)
        ),
      };

      // Override toString to hide automation
      const originalFunction = window.Function.prototype.toString;
      window.Function.prototype.toString = function() {
        if (this === window.Function.prototype.toString) return originalFunction.call(this);
        if (this === window.navigator.permissions.query) return 'function query() { [native code] }';
        return originalFunction.call(this);
      };
    });

    console.log('SeturScraper initialized successfully');
  }

  buildSeturUrl(hotelSlug: string, checkIn: string, checkOut: string, adults: number, childBirthdates: string[] = []): string {
    let url = `https://www.setur.com.tr/${hotelSlug}?in=${checkIn}&out=${checkOut}&room=${adults}`;
    if (childBirthdates.length > 0) {
      url += '_' + childBirthdates.join('_');
    }
    return url;
  }

  async waitForRoomElements(): Promise<boolean> {
    if (!this.page) throw new Error('SeturScraper not initialized');
    
    console.log('Waiting for room elements to load...');
    
    // Wait for page to be fully loaded first
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Multiple selectors to try for room elements
    const selectors = [
      '.swiper-wrapper',
      '[data-testid="room-card"]',
      '.room-card',
      '.hotel-room',
      '.sc-1d09eb94-1', // Room name selector
      '.sc-5ca8c7ad-9', // Price selector
      '.room-type',
      '.room-item',
      '[class*="room"]',
      '[class*="hotel"]',
      '[class*="card"]'
    ];

    // Wait for any of these selectors to appear
    for (const selector of selectors) {
      try {
        await this.page!.waitForSelector(selector, { timeout: 15000 });
        console.log(`Found room elements with selector: ${selector}`);
        return true;
      } catch (error) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    // If no specific selectors found, wait for any content that might be rooms
    try {
      await this.page!.waitForFunction(() => {
        const possibleRoomElements = document.querySelectorAll('[class*="room"], [class*="hotel"], [class*="card"]');
        return possibleRoomElements.length > 0;
      }, { timeout: 20000 });
      console.log('Found potential room elements with generic selectors');
      return true;
    } catch (error) {
      console.log('No room elements found with any selector');
      return false;
    }
  }

  async scrapeHotelRooms(params: SeturScrapeParams): Promise<SeturRoomData[]> {
    if (!this.page) throw new Error('SeturScraper not initialized');
    
    const { hotelSlug, checkIn, checkOut, adults, childBirthdates = [], headless = false } = params;
    const url = this.buildSeturUrl(hotelSlug, checkIn, checkOut, adults, childBirthdates);
    
    console.log('Navigating to:', url);
    
    try {
      // Navigate to the page
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Simulate human-like behavior
      await this.simulateHumanBehavior();

      // Wait for room elements to load
      const elementsFound = await this.waitForRoomElements();
      
      if (!elementsFound) {
        console.log('No room elements found, taking screenshot for debugging...');
        await this.page.screenshot({ 
          path: 'setur-debug-no-rooms.png', 
          fullPage: true 
        });
        
        // Try to get page content for debugging
        const pageContent = await this.page.content();
        await fs.writeFile('setur-page-content.html', pageContent);
        console.log('Page content saved to setur-page-content.html for debugging');
        
        return [];
      }

      // Take screenshot for debugging
      await this.page.screenshot({ 
        path: 'setur-room-section.png', 
        fullPage: true 
      });

      // Extract room data with multiple fallback strategies
      const rooms = await this.extractRoomData();
      
      console.log(`Extracted ${rooms.length} rooms from Setur`);
      return rooms;

    } catch (error) {
      console.error('Error during scraping:', error);
      await this.page.screenshot({ 
        path: 'setur-error.png', 
        fullPage: true 
      });
      throw error;
    }
  }

  private async simulateHumanBehavior(): Promise<void> {
    if (!this.page) return;
    
    console.log('Simulating human behavior...');
    
    // Simple scroll down
    await this.page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async extractRoomData(): Promise<SeturRoomData[]> {
    if (!this.page) throw new Error('SeturScraper not initialized');

    return await this.page.evaluate(() => {
      const rooms: SeturRoomData[] = [];
      
      console.log('Starting room data extraction...');
      
      // Strategy 1: Try swiper-wrapper approach
      const swiperWrappers = Array.from(document.querySelectorAll('.swiper-wrapper'));
      console.log(`Found ${swiperWrappers.length} swiper wrappers`);
      
      if (swiperWrappers.length > 0) {
        console.log('Using swiper-wrapper strategy');
        for (const wrapper of swiperWrappers) {
        const slides = wrapper.querySelectorAll('.swiper-slide');
          console.log(`Found ${slides.length} slides in wrapper`);
          
        for (const slide of slides) {
            const name = slide.querySelector('.sc-1d09eb94-1')?.textContent?.trim() || 
                        slide.querySelector('[class*="room-name"]')?.textContent?.trim() ||
                        slide.querySelector('[class*="title"]')?.textContent?.trim() || '';
            
            const price = slide.querySelector('.sc-5ca8c7ad-9')?.textContent?.trim() || 
                         slide.querySelector('[class*="price"]')?.textContent?.trim() ||
                         slide.querySelector('[class*="cost"]')?.textContent?.trim() || '';
            
          if (name) {
              rooms.push({ name, price });
              console.log(`Found room: ${name} - ${price}`);
            }
          }
        }
      }

      // Strategy 2: Try generic room card approach
      if (rooms.length === 0) {
        console.log('Using generic room card strategy');
        const roomCards = Array.from(document.querySelectorAll('[class*="room"], [class*="card"], [class*="hotel"]'));
        console.log(`Found ${roomCards.length} potential room cards`);
        
        for (const card of roomCards) {
          const name = card.querySelector('[class*="name"], [class*="title"], h1, h2, h3, h4')?.textContent?.trim() || '';
          const price = card.querySelector('[class*="price"], [class*="cost"], [class*="amount"]')?.textContent?.trim() || '';
          
          if (name && name.length > 3) { // Filter out very short names
            rooms.push({ name, price });
            console.log(`Found room: ${name} - ${price}`);
          }
        }
      }

      // Strategy 3: Try data attributes approach
      if (rooms.length === 0) {
        console.log('Using data attributes strategy');
        const elementsWithData = Array.from(document.querySelectorAll('[data-testid*="room"], [data-testid*="hotel"]'));
        console.log(`Found ${elementsWithData.length} elements with data attributes`);
        
        for (const element of elementsWithData) {
          const name = element.textContent?.trim() || '';
          if (name && name.length > 3) {
            rooms.push({ name, price: '' });
            console.log(`Found room: ${name}`);
          }
        }
      }

      // Strategy 4: Try any element with room-related text
      if (rooms.length === 0) {
        console.log('Using text content strategy');
        const allElements = Array.from(document.querySelectorAll('*'));
        console.log(`Scanning ${allElements.length} elements for room-related text`);
        
        for (const element of allElements) {
          const text = element.textContent?.trim() || '';
          if (text && (text.includes('Oda') || text.includes('Room') || text.includes('Suite') || text.includes('Deluxe'))) {
            const parent = element.closest('[class*="card"], [class*="item"], div');
            if (parent) {
              const name = text;
              const price = parent.querySelector('[class*="price"], [class*="cost"]')?.textContent?.trim() || '';
              rooms.push({ name, price });
              console.log(`Found room: ${name} - ${price}`);
            }
          }
        }
      }

      // Remove duplicates
      const uniqueRooms = rooms.filter((room, index, self) => 
        index === self.findIndex(r => r.name === room.name)
      );

      console.log(`Total unique rooms found: ${uniqueRooms.length}`);
      return uniqueRooms;
    });
  }

  async saveScrapedData(hotelSlug: string, checkIn: string, checkOut: string, rooms: SeturRoomData[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${hotelSlug}_${checkIn}_${checkOut}.json`;
    const dir = path.join(process.cwd(), 'src', 'scrapedData', 'setur');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    
    const dataToSave = {
      timestamp: new Date().toISOString(),
      hotelSlug,
      checkIn,
      checkOut,
      totalRooms: rooms.length,
      rooms
    };
    
    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
    console.log(`Setur data saved to: ${filePath}`);
    return filePath;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('SeturScraper closed');
    }
  }
}