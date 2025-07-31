import puppeteer, { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs/promises';
import * as path from 'path';

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

interface SearchParams {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  childAges?: number[];
}

interface HotelMapping {
  [hotelName: string]: string; // hotel name -> hotel ID
}

interface RoomData {
  roomName: string;
  displayName: string;
  roomSize: number;
  roomSizeUnit: string;
  price: number;
  currency: string;
  boardType: string;
  isRefundable: boolean;
  attributes: any[];
  mediaFiles: any[];
  offers: any[];
  capacity: number;
  bedType: string;
  cancellationPolicy: string;
  discountPercentage?: number;
  originalPrice?: number;
}

interface ScrapedData {
  hotelName: string;
  hotelId: string;
  searchParams: SearchParams;
  rooms: RoomData[];
  scrapedAt: string;
}

export class HotelsComScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private hotelMappingPath: string;
  private hotelMapping: HotelMapping = {};

  constructor() {
    this.hotelMappingPath = path.join(process.cwd(), 'src', 'scrapedData', 'hotelscom', 'hotel_mapping.json');
    this.hotelMapping = {};
  }

  /**
   * Load existing hotel ID mappings from JSON file
   */
  private async loadHotelMapping(): Promise<void> {
    try {
      const data = await fs.readFile(this.hotelMappingPath, 'utf-8');
      this.hotelMapping = JSON.parse(data);
      console.log(`Loaded ${Object.keys(this.hotelMapping).length} hotel mappings`);
    } catch (error) {
      console.log('No existing hotel mapping found, starting fresh');
      this.hotelMapping = {};
    }
  }

  /**
   * Save hotel ID mappings to JSON file
   */
  private async saveHotelMapping(): Promise<void> {
    try {
      const dir = path.dirname(this.hotelMappingPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.hotelMappingPath, JSON.stringify(this.hotelMapping, null, 2));
      console.log(`Saved ${Object.keys(this.hotelMapping).length} hotel mappings`);
    } catch (error: any) {
      console.error('Error saving hotel mapping:', error.message);
    }
  }

  /**
   * Initialize browser and page with advanced anti-detection
   */
  async initialize(): Promise<void> {
    try {
      // Load hotel mapping first
      await this.loadHotelMapping();
      
      // Use puppeteer-extra with stealth plugin for better anti-detection
      this.browser = await puppeteerExtra.launch({
        headless: false, // Keep visible for debugging captcha issues
        defaultViewport: null, // Use real viewport size
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images', // Faster loading
          '--disable-javascript-harmony-shipping',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-ipc-flooding-protection',
          '--window-size=1920,1080',
          '--start-maximized'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        slowMo: 50 // Add slight delay between actions
      });

      this.page = await this.browser.newPage();
      
      // Set realistic user agent
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await this.page.setUserAgent(randomUserAgent);
      
      // Set realistic viewport
      await this.page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });
      
      // Set additional headers to look more human
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      });
      
      // Override webdriver detection
      await this.page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Mock chrome runtime
        (window as any).chrome = {
          runtime: {},
        };
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'granted' } as PermissionStatus) :
            originalQuery(parameters)
        );
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
                enabledPlugin: Plugin,
              },
            },
          ],
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['tr-TR', 'tr', 'en-US', 'en'],
        });
      });
      
      // Enable request interception for additional stealth
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        // Block unnecessary resources to speed up loading
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          // Add random delays to requests
          setTimeout(() => {
            request.continue();
          }, Math.random() * 100);
        }
      });
      
      console.log('Hotels.com scraper initialized with advanced anti-detection');
    } catch (error: any) {
      console.error('Error initializing Hotels.com scraper:', error.message);
      throw error;
    }
  }

  /**
   * Human-like delay with randomization
   */
  private async humanDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Human-like typing with random delays
   */
  private async humanType(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.click(selector);
    await this.humanDelay(500, 1000);
    
    // Clear existing text
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await this.humanDelay(100, 300);
    
    // Type with human-like delays
    for (const char of text) {
      await this.page.keyboard.type(char);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
    }
    await this.humanDelay(500, 1000);
  }
  
  /**
   * Human-like mouse movement and click
   */
  private async humanClick(selector: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    const box = await element.boundingBox();
    if (!box) throw new Error(`Element has no bounding box: ${selector}`);
    
    // Move mouse to random position within element
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;
    
    await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
    await this.humanDelay(100, 500);
    await this.page.mouse.click(x, y);
    await this.humanDelay(300, 800);
  }
  
  /**
   * Check for and handle captcha
   */
  private async handleCaptcha(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Check for various captcha indicators
      const captchaSelectors = [
        '[data-testid="captcha"]',
        '.captcha',
        '#captcha',
        '[class*="captcha"]',
        '[id*="captcha"]',
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        '.g-recaptcha',
        '#cf-challenge-stage',
        '.cf-challenge-form'
      ];
      
      for (const selector of captchaSelectors) {
        const captchaElement = await this.page.$(selector);
        if (captchaElement) {
          console.log(`Captcha detected with selector: ${selector}`);
          console.log('Waiting for manual captcha resolution...');
          
          // Wait for captcha to be resolved (up to 2 minutes)
          let attempts = 0;
          const maxAttempts = 120; // 2 minutes with 1-second intervals
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const stillExists = await this.page.$(selector);
            if (!stillExists) {
              console.log('Captcha resolved!');
              return true;
            }
            attempts++;
          }
          
          console.log('Captcha resolution timeout');
          return false;
        }
      }
      
      return true; // No captcha found
    } catch (error) {
      console.error('Error checking for captcha:', error);
      return false;
    }
  }
  
  /**
   * Discover hotel ID by searching for hotel name with advanced anti-detection
   */
  async discoverHotelId(hotelName: string): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      console.log(`Searching for hotel ID: ${hotelName}`);

      // Navigate to Hotels.com search page with random delay
      console.log('Navigating to Hotels.com...');
      await this.page.goto('https://tr.hotels.com/', { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      await this.humanDelay(3000, 5000);
      
      // Check for captcha immediately after page load
      const captchaHandled = await this.handleCaptcha();
      if (!captchaHandled) {
        throw new Error('Captcha could not be resolved');
      }

      // Simulate human behavior - scroll a bit
      await this.page.evaluate(() => {
        window.scrollTo(0, Math.random() * 200);
      });
      await this.humanDelay(1000, 2000);

      // Find and click the search location input with multiple fallback selectors
      const searchLocationSelectors = [
        '[data-stid="search-location"]',
        '#destination_form_field',
        '[data-testid="destination-input"]',
        'input[placeholder*="destination"]',
        'input[placeholder*="hotel"]'
      ];
      
      let searchInput = null;
      for (const selector of searchLocationSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          searchInput = selector;
          break;
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!searchInput) {
        throw new Error('Could not find search input field');
      }
      
      console.log(`Using search input selector: ${searchInput}`);
      await this.humanClick(searchInput);
      await this.humanDelay(1000, 2000);

      // Type hotel name with human-like behavior
      console.log(`Typing hotel name: ${hotelName}`);
      await this.humanType(searchInput, hotelName);
      await this.humanDelay(2000, 4000);

      // Wait for autosuggestions and click the first result
      const suggestionSelectors = [
        '[data-stid="destination_form_field-result-item-button"]',
        '[data-testid="suggestion-item"]',
        '.suggestion-item',
        '[role="option"]'
      ];
      
      let suggestionFound = false;
      for (const selector of suggestionSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.humanClick(selector);
          suggestionFound = true;
          break;
        } catch (e) {
          console.log(`Suggestion selector ${selector} not found, trying next...`);
        }
      }
      
      if (!suggestionFound) {
        console.log('No suggestions found, pressing Enter');
        await this.page.keyboard.press('Enter');
      }
      
      await this.humanDelay(1000, 2000);

      // Click the search button with multiple selectors
      const searchButtonSelectors = [
        '#search_button',
        '[data-testid="search-button"]',
        'button[type="submit"]',
        '.search-button'
      ];
      
      let searchButtonFound = false;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.humanClick(selector);
          searchButtonFound = true;
          break;
        } catch (e) {
          console.log(`Search button selector ${selector} not found, trying next...`);
        }
      }
      
      if (!searchButtonFound) {
        console.log('Search button not found, pressing Enter');
        await this.page.keyboard.press('Enter');
      }
      
      await this.humanDelay(3000, 6000);
      
      // Check for captcha after search
      const captchaHandled2 = await this.handleCaptcha();
      if (!captchaHandled2) {
        throw new Error('Captcha appeared after search and could not be resolved');
      }

      // Wait for search results and click the first hotel
      const searchResultSelectors = [
        '.uitk-spacing.uitk-spacing-margin-blockstart-three',
        '[data-testid="property-card"]',
        '.hotel-result',
        '.property-listing'
      ];
      
      let resultFound = false;
      for (const selector of searchResultSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          await this.humanClick(selector);
          resultFound = true;
          break;
        } catch (e) {
          console.log(`Result selector ${selector} not found, trying next...`);
        }
      }
      
      if (!resultFound) {
        throw new Error('No search results found');
      }
      
      await this.humanDelay(3000, 6000);

      // Extract hotel ID from the URL
      const currentUrl = this.page.url();
      console.log('Hotel detail URL:', currentUrl);
      
      // Extract hotel ID from URL pattern: ho231359
      const hotelIdMatch = currentUrl.match(/\/ho(\d+)\//);
      
      if (hotelIdMatch && hotelIdMatch[1]) {
        const hotelId = hotelIdMatch[1];
        console.log(`Found hotel ID: ${hotelId} for ${hotelName}`);
        
        // Save to mapping
        this.hotelMapping[hotelName] = hotelId;
        await this.saveHotelMapping();
        
        return hotelId;
      } else {
        console.error('Could not extract hotel ID from URL:', currentUrl);
        return null;
      }

    } catch (error: any) {
      console.error(`Error discovering hotel ID for ${hotelName}:`, error.message);
      return null;
    }
  }

  /**
   * Build Hotels.com URL with parameters
   */
  private buildHotelsComUrl(hotelName: string, hotelId: string, searchParams: SearchParams): string {
    const { checkInDate, checkOutDate, adults, children = 0, childAges = [] } = searchParams;
    
    // Format dates: YYYY-MM-DD
    const formattedCheckIn = checkInDate;
    const formattedCheckOut = checkOutDate;
    
    // Build guest configuration: rm1=a1%3Ac4%3Ac8 (1 adult, 2 children ages 4,8)
    let guestConfig = `a${adults}`;
    if (children > 0 && childAges.length > 0) {
      guestConfig += `%3A${childAges.map(age => `c${age}`).join('%3A')}`;
    }
    
    // Convert hotel name to URL-friendly format
    const hotelSlug = hotelName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    return `https://tr.hotels.com/ho${hotelId}/${hotelSlug}/?chkin=${formattedCheckIn}&chkout=${formattedCheckOut}&rm1=${guestConfig}`;
  }

  /**
   * Scrape hotel details using direct URL
   */
  async scrapeHotelDetails(hotelName: string, searchParams: SearchParams): Promise<ScrapedData | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Get or discover hotel ID
      console.log(`Current hotel mapping:`, this.hotelMapping);
      let hotelId = this.hotelMapping[hotelName];
      console.log(`Looking for hotel: ${hotelName}, found ID: ${hotelId}`);
      
      if (!hotelId) {
        console.log(`Hotel ID not found for ${hotelName}, discovering...`);
        const discoveredId = await this.discoverHotelId(hotelName);
        if (!discoveredId) {
          throw new Error(`Could not discover hotel ID for ${hotelName}`);
        }
        hotelId = discoveredId;
      } else {
        console.log(`Using existing hotel ID: ${hotelId} for ${hotelName}`);
      }

      // Build URL and navigate
      const url = this.buildHotelsComUrl(hotelName, hotelId, searchParams);
      console.log(`Navigating to: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Scrape room data from property offer cards
      const roomData = await this.scrapeRoomsFromDOM();

      const scrapedData: ScrapedData = {
        hotelName,
        hotelId,
        searchParams,
        rooms: roomData,
        scrapedAt: new Date().toISOString()
      };

      console.log(`Scraped ${roomData.length} rooms for ${hotelName}`);
      return scrapedData;

    } catch (error: any) {
      console.error(`Error scraping hotel details for ${hotelName}:`, error.message);
      return null;
    }
  }

  /**
   * Scrape room data from DOM property offer cards
   */
  private async scrapeRoomsFromDOM(): Promise<RoomData[]> {
    if (!this.page) return [];

    try {
      const rooms = await this.page.evaluate(() => {
        const roomElements = document.querySelectorAll('[data-stid^="property-offer-"]');
        const roomData: any[] = [];

        roomElements.forEach((element) => {
          try {
            // Extract room name
            const roomNameElement = element.querySelector('h3.uitk-heading-6');
            const roomName = roomNameElement?.textContent?.trim() || 'Unknown Room';

            // Extract price information
            const priceElement = element.querySelector('.uitk-text.uitk-type-500.uitk-type-medium.uitk-text-emphasis-theme');
            const priceText = priceElement?.textContent || '';
            const price = priceText ? parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) : 0;

            // Extract original price (if discounted)
            const originalPriceElement = element.querySelector('del');
            const originalPriceText = originalPriceElement?.textContent || '';
            const originalPrice = originalPriceText ? parseFloat(originalPriceText.replace(/[^\d.,]/g, '').replace(',', '.')) : 0;

            // Calculate discount percentage
            let discountPercentage = 0;
            if (originalPrice > 0 && price > 0) {
              discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
            }

            // Extract capacity and bed type from typelist
            const typelistItems = element.querySelectorAll('.uitk-typelist-item');
            let capacity = 0;
            let bedType = '';
            let boardType = '';
            let attributes: string[] = [];

            typelistItems.forEach((item) => {
              const text = item.textContent?.trim() || '';
              if (text.includes('kişilik')) {
                const capacityMatch = text.match(/(\d+)\s*kişilik/);
                if (capacityMatch) {
                  capacity = parseInt(capacityMatch[1]);
                }
              }
              if (text.includes('Yatak') || text.includes('yatak')) {
                bedType = text;
              }
              if (text.includes('dâhil') || text.includes('inclusive')) {
                boardType = text;
              }
              attributes.push(text);
            });

            // Extract cancellation policy
            const cancellationElement = element.querySelector('.uitk-radio-button-label-content span');
            const cancellationPolicy = cancellationElement?.textContent?.trim() || '';

            // Extract per night price
            const perNightElement = element.querySelector('.uitk-text.uitk-type-end.uitk-type-300');
            const perNightText = perNightElement?.textContent || '';
            const perNightPrice = perNightText ? parseFloat(perNightText.replace(/[^\d.,]/g, '').replace(',', '.')) : price;

            roomData.push({
              roomName,
              displayName: roomName,
              roomSize: 0, // Not available in Hotels.com
              roomSizeUnit: 'm2',
              price: perNightPrice,
              currency: 'TRY',
              boardType,
              isRefundable: cancellationPolicy.includes('geri ödemeli'),
              attributes,
              mediaFiles: [],
              offers: [],
              capacity,
              bedType,
              cancellationPolicy,
              discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
              originalPrice: originalPrice > 0 ? originalPrice : undefined
            });
          } catch (error) {
            console.error('Error parsing room element:', error);
          }
        });

        return roomData;
      });

      return rooms;
    } catch (error: any) {
      console.error('Error scraping rooms from DOM:', error.message);
      return [];
    }
  }

  /**
   * Save scraped data to file
   */
  async saveScrapedData(scrapedData: ScrapedData): Promise<string> {
    try {
      const { hotelName, searchParams } = scrapedData;
      const { adults, children = 0, childAges = [] } = searchParams;
      
      // Create filename based on guest configuration
      let filename = `${adults}ad`;
      if (children > 0 && childAges.length > 0) {
        filename += `-${children}chld-${childAges.join('-')}`;
      }
      filename += '.json';
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hotelSlug = hotelName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '_');
      const finalFilename = `${timestamp}_${hotelSlug}_${filename}`;
      
      const dir = path.join(process.cwd(), 'src', 'scrapedData', 'hotelscom');
      await fs.mkdir(dir, { recursive: true });
      
      const filePath = path.join(dir, finalFilename);
      await fs.writeFile(filePath, JSON.stringify(scrapedData, null, 2));
      
      console.log(`Scraped data saved to: ${filePath}`);
      return filePath;
    } catch (error: any) {
      console.error('Error saving scraped data:', error.message);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('Hotels.com scraper closed');
    }
  }
} 