import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchParams {
  hotelName: string;
  checkInDate: string; // Format: DD.MM.YYYY
  checkOutDate: string; // Format: DD.MM.YYYY
  adults: number;
  children: number;
}

interface ScrapedHotelData {
  success: boolean;
  hotelName?: string;
  rooms?: any[];
  error?: string;
  scrapedAt?: string;
  searchParams?: SearchParams;
}

export class EnuygunScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(headless: boolean = true): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      
      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });
      
      console.log('✅ Enuygun scraper initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enuygun scraper:', error);
      throw error;
    }
  }

  async searchHotels(params: SearchParams): Promise<boolean> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    try {
      console.log('🔍 Starting hotel search on Enuygun...');
      
      // 1. Navigate to search page
      await this.page.goto('https://www.enuygun.com/otel/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      console.log('✅ Loaded search page');

      // 2. Fill hotel name in location input
      await this.fillHotelName(params.hotelName);
      
      // 3. Set dates
      await this.setDates(params.checkInDate, params.checkOutDate);
      
      // 4. Set guest count
      await this.setGuestCount(params.adults, params.children);
      
      // 5. Click search button
      await this.clickSearchButton();
      
      console.log('✅ Search completed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      return false;
    }
  }

  private async fillHotelName(hotelName: string): Promise<void> {
    if (!this.page) return;

    try {
      console.log(`🏨 Filling hotel name: ${hotelName}`);
      
      // Wait for the location input to be available
      await this.page.waitForSelector('[data-testid="endesign-hotel-autosuggestion-input"]', { timeout: 10000 });
      
      // Clear existing value and type hotel name
      await this.page.click('[data-testid="endesign-hotel-autosuggestion-input"]');
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      
      await this.page.type('[data-testid="endesign-hotel-autosuggestion-input"]', hotelName, { delay: 100 });
      
      // Wait for autosuggestions to appear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Select the first hotel suggestion (if available)
      const hotelSuggestion = await this.page.$('[data-testid*="hotel-"][data-testid*="-highlight-wrapper"]');
      if (hotelSuggestion) {
        await hotelSuggestion.click();
        console.log('✅ Selected hotel from autosuggestions');
      } else {
        console.log('⚠️ No hotel autosuggestion found, continuing with typed text');
      }
      
    } catch (error) {
      console.error('❌ Failed to fill hotel name:', error);
      throw error;
    }
  }

  private async setDates(checkInDate: string, checkOutDate: string): Promise<void> {
    if (!this.page) return;

    try {
      console.log(`📅 Setting dates: ${checkInDate} to ${checkOutDate}`);
      
      // Click on the date picker button - try multiple possible selectors
      const datePickerSelectors = [
        '[data-testid="hotel-mobile-date-picker-button"]',
        '.Hotel-mobile-module_hotelMobileDatePickerContainer__aqa9c',
        '[data-testid*="date"]',
        '[data-testid*="picker"]'
      ];
      
      let datePickerFound = false;
      for (const selector of datePickerSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          await this.page.click(selector);
          console.log(`✅ Found date picker with selector: ${selector}`);
          datePickerFound = true;
          break;
        } catch (error) {
          console.log(`⚠️ Selector not found: ${selector}`);
        }
      }
      
      if (!datePickerFound) {
        throw new Error('Could not find date picker button');
      }
      
      // Wait for date picker to open - try multiple selectors
      const datePickerPanelSelectors = [
        '[data-testid="hotel-datepicker-popover-panel"]',
        '.hotel-datepicker-popover-panel'
      ];
      
      let panelFound = false;
      for (const selector of datePickerPanelSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Found date picker panel with selector: ${selector}`);
          panelFound = true;
          break;
        } catch (error) {
          console.log(`⚠️ Date picker panel selector not found: ${selector}`);
        }
      }
      
      if (!panelFound) {
        throw new Error('Could not find date picker panel');
      }
      
      // Parse dates
      const [checkInDay, checkInMonth, checkInYear] = checkInDate.split('.');
      const [checkOutDay, checkOutMonth, checkOutYear] = checkOutDate.split('.');
      
      console.log(`📅 Checking if dates are already selected: ${checkInDay}/${checkInMonth}/${checkInYear} to ${checkOutDay}/${checkOutMonth}/${checkOutYear}`);
      
      // Scroll the date picker into view if needed
      await this.page.evaluate(() => {
        const datePicker = document.querySelector('[data-testid="hotel-datepicker-popover-panel"]');
        if (datePicker) {
          datePicker.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      
      // Wait a bit for scrolling
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if dates are already selected by looking at the header
      const startDateText = await this.page.$eval(
        '[data-testid="hotel-range-header-start-date-text"]',
        el => el.textContent?.trim() || ''
      );
      const endDateText = await this.page.$eval(
        '[data-testid="hotel-range-header-end-date-text"]',
        el => el.textContent?.trim() || ''
      );
      
      console.log(`📅 Current selected dates: ${startDateText} to ${endDateText}`);
      
      // Check if the first date is already selected correctly
      const isFirstDateSelected = startDateText.includes(checkInDay.toString());
      
      if (isFirstDateSelected) {
        console.log(`✅ Check-in date (${checkInDay}) is already selected, skipping...`);
      } else {
        console.log(`📅 Step 1: Selecting check-in date (${checkInDay}/${checkInMonth}/${checkInYear})`);
        await this.selectDate(parseInt(checkInDay), parseInt(checkInMonth), parseInt(checkInYear));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Second: Select check-out date
      console.log(`📅 Step 2: Selecting check-out date (${checkOutDay}/${checkOutMonth}/${checkOutYear})`);
      await this.selectDateInAnyMonth(parseInt(checkOutDay), parseInt(checkOutMonth), parseInt(checkOutYear));
      
      // Close date picker by clicking outside or pressing escape
      await this.page.keyboard.press('Escape');
      
      console.log('✅ Dates set successfully');
      
    } catch (error) {
      console.error('❌ Failed to set dates:', error);
      throw error;
    }
  }

  private async selectDate(day: number, month: number, year: number): Promise<void> {
    if (!this.page) return;

    try {
      console.log(`📅 Attempting to select date: ${day}/${month}/${year}`);
      
      // Wait a bit for the date picker to fully load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try multiple approaches to select the date
      const dateSelectors = [
        `button[data-day="${day}"][data-testid="datepicker-active-day"]`,
        `button[data-day="${day}"]`,
        `[data-day="${day}"]`
      ];
      
      let dateSelected = false;
      for (const selector of dateSelectors) {
        try {
          const dateElement = await this.page.$(selector);
          if (dateElement) {
            await dateElement.click();
            console.log(`✅ Selected date with selector: ${selector}`);
            dateSelected = true;
            break;
          }
        } catch (error) {
          console.log(`⚠️ Date selector failed: ${selector}`);
        }
      }
      
      if (!dateSelected) {
        // Fallback: try to find any clickable element with the day number
        const allElements = await this.page.$$('*');
        for (const element of allElements) {
          try {
            const text = await element.evaluate(el => el.textContent);
            if (text && text.trim() === day.toString()) {
              await element.click();
              console.log(`✅ Selected date by text content: ${day}`);
              dateSelected = true;
              break;
            }
          } catch (error) {
            // Continue to next element
          }
        }
      }
      
      if (!dateSelected) {
        throw new Error(`Could not select date ${day}/${month}/${year}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to select date:', error);
      throw error;
    }
  }

  private async selectDateInAnyMonth(day: number, month: number, year: number): Promise<void> {
    if (!this.page) return;

    try {
      console.log(`📅 Attempting to select date in any month: ${day}/${month}/${year}`);
      
      // Wait a bit for the date picker to update after first selection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Since both months are visible side by side, try to find the date in any month
      const dateSelectors = [
        `button[data-day="${day}"][data-testid="datepicker-active-day"]`,
        `button[data-day="${day}"]`,
        `[data-day="${day}"]`
      ];
      
      let dateSelected = false;
      for (const selector of dateSelectors) {
        try {
          const dateElements = await this.page.$$(selector);
          console.log(`🔍 Found ${dateElements.length} elements with selector: ${selector}`);
          
          for (const dateElement of dateElements) {
            try {
              // Check if the element is visible and clickable
              const isVisible = await dateElement.evaluate(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && 
                       window.getComputedStyle(el).visibility !== 'hidden' &&
                       window.getComputedStyle(el).display !== 'none';
              });
              
              if (isVisible) {
                await dateElement.click();
                console.log(`✅ Selected date ${day} with selector: ${selector}`);
                dateSelected = true;
                break;
              } else {
                console.log(`⚠️ Date element not visible: ${selector}`);
              }
            } catch (error) {
              console.log(`⚠️ Failed to click date element: ${error}`);
            }
          }
          if (dateSelected) break;
        } catch (error) {
          console.log(`⚠️ Date selector failed: ${selector}`);
        }
      }
      
      if (!dateSelected) {
        throw new Error(`Could not select date ${day}/${month}/${year} in any month`);
      }
      
    } catch (error) {
      console.error('❌ Failed to select date in any month:', error);
      throw error;
    }
  }

  private getMonthName(month: number): string {
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return months[month - 1];
  }

  private async setGuestCount(adults: number, children: number): Promise<void> {
    if (!this.page) return;

    try {
      console.log(`👥 Setting guest count: ${adults} adults, ${children} children`);
      
      // Click on the guest count button - try multiple selectors
      const guestButtonSelectors = [
        '[data-testid="hotel-popover-button"]',
        '[data-testid*="guest"]',
        '[data-testid*="person"]'
      ];
      
      let guestButtonFound = false;
      for (const selector of guestButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          await this.page.click(selector);
          console.log(`✅ Found guest button with selector: ${selector}`);
          guestButtonFound = true;
          break;
        } catch (error) {
          console.log(`⚠️ Guest button selector not found: ${selector}`);
        }
      }
      
      if (!guestButtonFound) {
        throw new Error('Could not find guest count button');
      }
      
      // Wait for guest popover to open
      await this.page.waitForSelector('[data-testid="hotel-popover-panel"]', { timeout: 10000 });
      
      // Set adults count
      await this.setCounterValue('hotel-adult-counter', adults);
      
      // Set children count
      await this.setCounterValue('hotel-child-counter', children);
      
      // Click "Tamam" button to confirm
      await this.page.click('[data-testid="hotel-guest-submit-button"]');
      
      console.log('✅ Guest count set successfully');
      
    } catch (error) {
      console.error('❌ Failed to set guest count:', error);
      throw error;
    }
  }

  private async setCounterValue(counterType: string, targetValue: number): Promise<void> {
    if (!this.page) return;

    try {
      // Get current value
      const currentValue = await this.page.$eval(
        `[data-testid="${counterType}-count"]`,
        (el) => parseInt(el.textContent || '0')
      );
      
      console.log(`📊 Current ${counterType}: ${currentValue}, Target: ${targetValue}`);
      
      // Adjust to target value
      while (currentValue < targetValue) {
        await this.page.click(`[data-testid="${counterType}-plus-button"]`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      while (currentValue > targetValue) {
        await this.page.click(`[data-testid="${counterType}-minus-button"]`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`❌ Failed to set ${counterType}:`, error);
      throw error;
    }
  }

  private async clickSearchButton(): Promise<void> {
    if (!this.page) return;

    try {
      console.log('🔍 Clicking search button...');
      
      // Wait for and click the search button - try multiple selectors
      const searchButtonSelectors = [
        '[data-testid="hotel-submit-search-button"]',
        'button:contains("Otel bul")',
        'button:contains("Find hotel")',
        '[data-testid*="search"]',
        '[data-testid*="submit"]'
      ];
      
      let searchButtonFound = false;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          await this.page.click(selector);
          console.log(`✅ Found search button with selector: ${selector}`);
          searchButtonFound = true;
          break;
        } catch (error) {
          console.log(`⚠️ Search button selector not found: ${selector}`);
        }
      }
      
      if (!searchButtonFound) {
        throw new Error('Could not find search button');
      }
      
      // Wait for navigation to search results
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      
      console.log('✅ Navigated to search results');
      
    } catch (error) {
      console.error('❌ Failed to click search button:', error);
      throw error;
    }
  }

  async navigateToSpecificHotel(hotelName: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    try {
      console.log(`🏨 Checking if we're already on the hotel page: ${hotelName}`);
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we're already on the hotel page by looking for hotel name in the page
      const pageTitle = await this.page.title();
      const pageContent = await this.page.content();
      
      console.log(`📄 Page title: ${pageTitle}`);
      
      // Check if hotel name appears in page title or content
      if (pageTitle.toLowerCase().includes(hotelName.toLowerCase()) || 
          pageContent.toLowerCase().includes(hotelName.toLowerCase())) {
        console.log('✅ Already on the hotel page!');
        return true;
      }
      
      // If not on hotel page, try to find hotel in search results (fallback)
      console.log('⚠️ Not on hotel page, checking for search results...');
      const hotelSelector = '[data-testid*="' + hotelName.toLowerCase().replace(/\s+/g, '-') + '"]';
      const hotelElement = await this.page.$(hotelSelector);
      
      if (hotelElement) {
        await hotelElement.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        console.log('✅ Navigated to specific hotel from search results');
        return true;
      } else {
        console.log('⚠️ Hotel not found in search results');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Failed to navigate to specific hotel:', error);
      return false;
    }
  }

  async scrapeHotelDetails(): Promise<ScrapedHotelData> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    try {
      console.log('🔍 Starting hotel details scraping...');
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get hotel name
      const hotelName = await this.page.$eval('h1', (el) => el.textContent?.trim() || 'Unknown Hotel');
      
      console.log(`🏨 Scraping details for: ${hotelName}`);
      
      // Check if we need to search for rooms
      const searchButton = await this.page.$('[data-testid="detail-search-button"]');
      if (searchButton) {
        console.log('🔍 Found search button, clicking to find rooms...');
        await searchButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Wait for rooms container to load
      await this.page.waitForSelector('#rooms-container', { timeout: 10000 });
      
      // Extract room data
      const rooms = await this.page.evaluate(() => {
        const roomCards = document.querySelectorAll('[data-testid="room-card-wrapper"]');
        const extractedRooms: any[] = [];
        
        roomCards.forEach((card, index) => {
          try {
            // Room name
            const roomNameElement = card.querySelector('[data-testid="room-name"]');
            const roomName = roomNameElement?.textContent?.trim() || `Room ${index + 1}`;
            
            // Room features
            const features: string[] = [];
            const featureElements = card.querySelectorAll('.sc-dcdcb90f-26');
            featureElements.forEach(feature => {
              const text = feature.textContent?.trim();
              if (text) features.push(text);
            });
            
            // Room size and view
            const sizeElement = card.querySelector('.sc-dcdcb90f-24 span');
            const size = sizeElement?.textContent?.trim() || '';
            
            // Pricing information
            const discountLabel = card.querySelector('[data-testid="offer-discount-label"]')?.textContent?.trim() || '';
            const originalPrice = card.querySelector('[data-testid="offer-discount-price"]')?.textContent?.trim() || '';
            const finalPrice = card.querySelector('[data-testid="offer-price"]')?.textContent?.trim() || '';
            
            // Room concept (e.g., "Her Şey Dahil")
            const conceptElement = card.querySelector('[data-testid="offer-concept-description"]');
            const concept = conceptElement?.textContent?.trim() || '';
            
            // Room class info (e.g., "İptal edilemez")
            const classElement = card.querySelector('[data-testid="offer-info-room-class"]');
            const roomClass = classElement?.textContent?.trim() || '';
            
            extractedRooms.push({
              name: roomName,
              size: size,
              features: features,
              concept: concept,
              roomClass: roomClass,
              discountLabel: discountLabel,
              originalPrice: originalPrice,
              finalPrice: finalPrice,
              index: index
            });
            
          } catch (error) {
            console.error(`Error extracting room ${index}:`, error);
          }
        });
        
        return extractedRooms;
      });
      
      console.log(`✅ Successfully extracted ${rooms.length} rooms`);
      
      return {
        success: true,
        hotelName: hotelName,
        rooms: rooms
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
      // Create enuygun directory if it doesn't exist
      const enuygunDir = path.join(process.cwd(), 'src', 'scrapedData', 'enuygun');
      await fs.mkdir(enuygunDir, { recursive: true });
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create filename
      const hotelNameSlug = data.hotelName?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'unknown_hotel';
      const filename = `${timestamp}_${hotelNameSlug}.json`;
      const filepath = path.join(enuygunDir, filename);
      
      // Prepare data to save
      const dataToSave = {
        ...data,
        scrapedAt: new Date().toISOString(),
        searchParams: searchParams,
        scraper: 'EnuygunScraper'
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
      console.log('✅ Enuygun scraper closed');
    }
  }
} 