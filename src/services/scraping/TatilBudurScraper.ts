import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchParams {
  hotelName: string;
  checkInDate: string; // Format: DD.MM.YYYY
  checkOutDate: string; // Format: DD.MM.YYYY
  adults: number;
  children: number;
  childAges?: number[]; // Ages of children (1-12)
}

interface ScrapedHotelData {
  success: boolean;
  hotelName?: string;
  rooms?: any[];
  error?: string;
  scrapedAt?: string;
  searchParams?: SearchParams;
}

export class TatilBudurScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly baseUrl = 'https://www.tatilbudur.com';

  constructor() {
    console.log('🏨 TatilBudur scraper initialized');
  }

  async initialize(headless: boolean = true): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--start-maximized',
        ],
      });
      this.page = await this.browser.newPage();
      
      // Set viewport to a larger size
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('✅ TatilBudur scraper initialized');
    } catch (error) {
      console.error('❌ Failed to initialize TatilBudur scraper:', error);
      throw error;
    }
  }

  async navigateToHotel(hotelSlug: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    const url = `${this.baseUrl}/${hotelSlug}`;
    console.log(`🏨 Navigating to: ${url}`);
    
    await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Handle popups that might appear
    await this.handlePopups();
    
    console.log('✅ Loaded hotel page');
  }

  private async handlePopups(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Wait a bit for popups to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to close modal popups
      const popupSelectors = [
        '.modal-content .close-button',
        '.modal-content svg[use*="close"]',
        'svg[use*="close"]',
        '.close-button',
        '[data-dismiss="modal"]'
      ];
      
      for (const selector of popupSelectors) {
        try {
          const popupElement = await this.page.$(selector);
          if (popupElement) {
            await popupElement.click();
            console.log(`✅ Closed popup with selector: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
         } catch (error) {
       console.log('⚠️ No popups found or failed to close popups');
     }
   }

  async setDates(checkInDate: string, checkOutDate: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log(`📅 Setting dates: ${checkInDate} to ${checkOutDate}`);
    
    try {
      // Open the date picker
      await this.page.waitForSelector('.hotel-search-daterange', { timeout: 10000 });
      await this.page.click('.hotel-search-daterange');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for the daterangepicker to appear
      await this.page.waitForSelector('.daterangepicker', { timeout: 10000 });
      
      // Parse dates
      const [checkInDay, checkInMonth, checkInYear] = checkInDate.split('.').map(Number);
      const [checkOutDay, checkOutMonth, checkOutYear] = checkOutDate.split('.').map(Number);
      
      // Click check-in date
      await this.selectDateInDaterangepicker(checkInDay, checkInMonth, checkInYear);
      await new Promise(resolve => setTimeout(resolve, 500));
      // Click check-out date
      await this.selectDateInDaterangepicker(checkOutDay, checkOutMonth, checkOutYear);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Wait for Uygula button to be enabled and scroll into view
      await this.page.waitForSelector('.applyBtn', { timeout: 5000 });
      const uygulaBtn = await this.page.$('.applyBtn');
      if (!uygulaBtn) {
        throw new Error('Uygula button not found after selecting dates.');
      }
      
      // Scroll button into view
      await uygulaBtn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if button is enabled
      const isEnabled = await uygulaBtn.evaluate(el => !el.hasAttribute('disabled'));
      if (!isEnabled) {
        console.log('⚠️ Uygula button is disabled, waiting for it to be enabled...');
        await this.page.waitForSelector('.applyBtn:not([disabled])', { timeout: 10000 });
      }
      
      // Try to click with error handling
      try {
        await uygulaBtn.click();
        console.log('✅ Uygula button clicked successfully');
      } catch (clickError) {
        console.log('⚠️ Failed to click Uygula button, trying alternative method...');
        // Try clicking with JavaScript
        await this.page.evaluate(() => {
          const btn = document.querySelector('.applyBtn') as HTMLElement;
          if (btn) btn.click();
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Dates set successfully');
      
    } catch (error) {
      console.error('❌ Failed to set dates:', error);
      throw error;
    }
  }

  private async selectDateInDaterangepicker(day: number, month: number, year: number): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    const selector = `td[data-day="${day}"][data-month="${month}"][data-year="${year}"]:not(.disabled)`;
    await this.page.waitForSelector(selector, { timeout: 5000 });
    const el = await this.page.$(selector);
    if (!el) throw new Error(`Date cell for ${day}.${month}.${year} not found or not clickable.`);
    await el.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await new Promise(resolve => setTimeout(resolve, 200));
    await el.click();
    console.log(`✅ Clicked date: ${day}.${month}.${year}`);
  }

  async setGuestCount(adults: number, children: number, childAges: number[] = []): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log(`👥 Setting guest count: ${adults} adults, ${children} children`);
    if (children > 0 && childAges.length > 0) {
      console.log(`👶 Child ages: ${childAges.join(', ')}`);
    }
    
    try {
      // Click on the person count input to open dropdown
      await this.page.waitForSelector('#quickPersonCount', { timeout: 10000 });
      const personInput = await this.page.$('#quickPersonCount');
      if (personInput) {
        await personInput.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      try {
        await this.page.click('#quickPersonCount');
        console.log('✅ Person count input clicked successfully');
      } catch (clickError) {
        console.log('⚠️ Failed to click person count input, trying JavaScript method...');
        await this.page.evaluate(() => {
          const input = document.querySelector('#quickPersonCount') as HTMLElement;
          if (input) input.click();
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for dropdown to appear
      await this.page.waitForSelector('.c-finder__dropdown', { timeout: 10000 });
      
      // Check if we need to adjust counts
      const currentAdultCount = await this.page.$eval('.c-finder__dropdown-count--adult .c-finder__dropdown-count-input', el => parseInt(el.textContent || '0'));
      const currentChildrenCount = await this.page.$eval('.c-finder__dropdown-count--children .c-finder__dropdown-count-input', el => parseInt(el.textContent || '0'));
      
      if (currentAdultCount !== adults || currentChildrenCount !== children) {
        // Set adult count
        await this.setCounterValue('adult', adults);
        
        // Set children count
        await this.setCounterValue('children', children);
      } else {
        console.log('✅ Guest counts are already correct, skipping adjustment');
      }
      
      // Set child ages if children > 0
      if (children > 0 && childAges.length > 0) {
        await this.setChildAges(childAges);
      }
      
      // Click "Uygula" button
      const applyBtn = await this.page.$('.apply-hotel-customer-btn');
      if (applyBtn) {
        await applyBtn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        await this.page.click('.apply-hotel-customer-btn');
        console.log('✅ Guest count Uygula button clicked successfully');
      } catch (clickError) {
        console.log('⚠️ Failed to click guest count Uygula button, trying JavaScript method...');
        await this.page.evaluate(() => {
          const btn = document.querySelector('.apply-hotel-customer-btn') as HTMLElement;
          if (btn) btn.click();
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Guest count set successfully');
      
    } catch (error) {
      console.error('❌ Failed to set guest count:', error);
      throw error;
    }
  }

  private async setChildAges(childAges: number[]): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('👶 Setting child ages...');
    
    // Wait a bit for child age dropdowns to appear after setting children count
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (let i = 0; i < childAges.length; i++) {
      const childNumber = i + 1;
      const age = childAges[i];
      
      try {
        // Try multiple selectors for child age dropdowns
        const dropdownSelectors = [
          `.c-finder__dropdown-footer-row.child-selection:nth-child(${childNumber}) select`,
          `.c-finder__dropdown-footer-row:nth-child(${childNumber}) select`,
          `.child-selection:nth-child(${childNumber}) select`,
          `select[name=""]`, // Generic select for child age
          `.c-finder__dropdown select`
        ];
        
        let dropdownFound = false;
        for (const selector of dropdownSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });
            await this.page.select(selector, age.toString());
            console.log(`✅ Set child ${childNumber} age to ${age} using selector: ${selector}`);
            dropdownFound = true;
            break;
          } catch (error) {
            // Continue to next selector
          }
        }
        
        if (!dropdownFound) {
          console.log(`⚠️ Could not find dropdown for child ${childNumber}, trying JavaScript method...`);
          // Try to set age using JavaScript
          await this.page.evaluate((childNum, childAge) => {
            const selects = document.querySelectorAll('.c-finder__dropdown select');
            if (selects[childNum - 1]) {
              (selects[childNum - 1] as HTMLSelectElement).value = childAge.toString();
              console.log(`Set child ${childNum} age to ${childAge} via JavaScript`);
            }
          }, childNumber, age);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to set age for child ${childNumber}:`, error);
        // Don't throw error, continue with other children
      }
    }
  }

  private async setCounterValue(counterType: string, targetValue: number): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    const counterSelector = `.c-finder__dropdown-count--${counterType}`;
    const decreaseSelector = `${counterSelector} .c-finder__dropdown-count-decrease`;
    const increaseSelector = `${counterSelector} .c-finder__dropdown-count-increase`;
    const valueSelector = `${counterSelector} .c-finder__dropdown-count-input`;
    
    // Get current value
    const currentValueText = await this.page.$eval(valueSelector, el => el.textContent?.trim() || '0');
    let currentValue = parseInt(currentValueText);
    
    console.log(`📊 Current ${counterType} count: ${currentValue}, Target: ${targetValue}`);
    
    // Adjust to target value
    while (currentValue !== targetValue) {
      if (currentValue < targetValue) {
        try {
          await this.page.click(increaseSelector);
          console.log(`✅ Clicked ${counterType} increase button`);
        } catch (clickError) {
          console.log(`⚠️ Failed to click ${counterType} increase button, trying JavaScript method...`);
          await this.page.evaluate((selector) => {
            const btn = document.querySelector(selector) as HTMLElement;
            if (btn) btn.click();
          }, increaseSelector);
        }
        currentValue++;
      } else {
        try {
          await this.page.click(decreaseSelector);
          console.log(`✅ Clicked ${counterType} decrease button`);
        } catch (clickError) {
          console.log(`⚠️ Failed to click ${counterType} decrease button, trying JavaScript method...`);
          await this.page.evaluate((selector) => {
            const btn = document.querySelector(selector) as HTMLElement;
            if (btn) btn.click();
          }, decreaseSelector);
        }
        currentValue--;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async clickSearchButton(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔍 Clicking search button...');
    
    try {
      await this.page.waitForSelector('.findRoom', { timeout: 10000 });
      await this.page.click('.findRoom');
      
      // Wait for navigation/loading
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Search completed successfully');
      
    } catch (error) {
      console.error('❌ Failed to click search button:', error);
      throw error;
    }
  }

  async searchHotels(params: SearchParams): Promise<void> {
    console.log('🔍 Starting TatilBudur search flow...');
    
    try {
      // Navigate to hotel page
      const hotelSlug = params.hotelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await this.navigateToHotel(hotelSlug);
      
      // Set dates
      await this.setDates(params.checkInDate, params.checkOutDate);
      
      // Set guest count
      await this.setGuestCount(params.adults, params.children, params.childAges);
      
      // Click search button
      await this.clickSearchButton();
      
      console.log('✅ Search flow completed successfully!');
      
    } catch (error) {
      console.error('❌ Search flow failed:', error);
      throw error;
    }
  }

  async scrapeHotelDetails(): Promise<ScrapedHotelData> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔍 Starting hotel details scraping...');
    
    try {
      // Wait for room results to load
      await this.page.waitForSelector('.room-type-new', { timeout: 15000 });
      
      // Get hotel name from page title or content
      const hotelName = await this.page.$eval('h1, .hotel-name, title', el => {
        const text = el.textContent?.trim() || '';
        return text.replace(' | TatilBudur', '').replace(' - TatilBudur', '');
      }).catch(() => 'Unknown Hotel');
      
      console.log(`🏨 Scraping details for: ${hotelName}`);
      
      // Extract room data
      const rooms = await this.page.$$eval('.room-type-new', (roomElements) => {
        return roomElements.map((roomElement, index) => {
          try {
            // Room name
            const nameElement = roomElement.querySelector('.room-type-title');
            const name = nameElement?.textContent?.trim() || 'Unknown Room';
            
            // Room size
            const sizeElement = roomElement.querySelector('.features-check-list li span.free');
            const size = sizeElement?.textContent?.trim() || '';
            
            // Features
            const featureElements = roomElement.querySelectorAll('.features-check-list li span:not(.free)');
            const features = Array.from(featureElements).map(feature => feature.textContent?.trim()).filter(Boolean);
            
            // Meal type/concept
            const mealElement = roomElement.querySelector('.meal-type-desc');
            const concept = mealElement?.textContent?.trim() || '';
            
            // Price
            const priceElement = roomElement.querySelector('.sell-price');
            const price = priceElement?.textContent?.trim() || '';
            
            // Original price (if there's a discount)
            const originalPriceElement = roomElement.querySelector('.upPrice');
            const originalPrice = originalPriceElement?.textContent?.trim() || price;
            
            // TB Club points
            const pointsElement = roomElement.querySelector('.c-card__tb-club');
            const tbPoints = pointsElement?.textContent?.trim() || '';
            
            return {
              name,
              size,
              features,
              concept,
              price,
              originalPrice,
              tbPoints,
              index
            };
          } catch (error) {
            console.error('Error extracting room data:', error);
            return {
              name: 'Error extracting room data',
              size: '',
              features: [],
              concept: '',
              price: '',
              originalPrice: '',
              tbPoints: '',
              index
            };
          }
        });
      });
      
      console.log(`✅ Successfully extracted ${rooms.length} rooms`);
      
      return {
        success: true,
        hotelName,
        rooms
      };
      
    } catch (error) {
      console.error('❌ Failed to scrape hotel details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async saveScrapedData(data: ScrapedHotelData, searchParams: SearchParams): Promise<string> {
    try {
      // Create tatilbudur directory if it doesn't exist
      const tatilbudurDir = path.join(process.cwd(), 'src', 'scrapedData', 'tatilbudur');
      await fs.mkdir(tatilbudurDir, { recursive: true });
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create filename
      const hotelNameSlug = data.hotelName?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'unknown_hotel';
      const filename = `${timestamp}_${hotelNameSlug}.json`;
      const filepath = path.join(tatilbudurDir, filename);
      
      // Prepare data to save
      const dataToSave = {
        ...data,
        scrapedAt: new Date().toISOString(),
        searchParams: searchParams,
        scraper: 'TatilBudurScraper'
      };
      
      // Save to file
      await fs.writeFile(filepath, JSON.stringify(dataToSave, null, 2), 'utf8');
      
      console.log(`✅ Scraped data saved to: ${filepath}`);
      return filepath;
      
    } catch (error) {
      console.error('❌ Failed to save scraped data:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ TatilBudur scraper closed');
    }
  }
} 