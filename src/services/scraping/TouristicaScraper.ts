import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface SearchParams {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  childAges?: number[];
}

interface PricePeriod {
  period: string;
  weekDays: string;
  minimumNights: string;
}

interface PricingInfo {
  discountRate: string;
  boardType: string;
  doubleRoomPrice: string;
  doubleRoomOldPrice: string;
  singleRoomPrice: string;
  singleRoomOldPrice: string;
  extraBedPrice: string;
  extraBedOldPrice: string;
  childPolicy: string;
  installmentLink: string;
}

interface RoomData {
  roomName: string;
  pricePeriods: PricePeriod[];
  pricingInfo: PricingInfo[];
}

interface OdalarVeFiyatlarData {
  roomName: string;
  availability: string;
  price: string;
  oldPrice?: string;
  boardType: string;
  roomType: string;
  discounts?: string[];
  capacity?: string;
}

interface ScrapedData {
  hotelName: string;
  hotelSlug: string;
  searchParams: SearchParams;
  scrapedAt: string;
  odalarVeFiyatlar: OdalarVeFiyatlarData[];
  fiyatListesi: RoomData[];
}

export class TouristicaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(headless: boolean = true): Promise<void> {
    console.log('🚀 Initializing Touristica scraper...');
    
    this.browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    console.log('✅ Touristica scraper initialized');
  }

  private buildTouristicaUrl(hotelSlug: string): string {
    return `https://www.touristica.com.tr/${hotelSlug}`;
  }

  private async navigateToHotelPage(hotelSlug: string): Promise<void> {
    const url = this.buildTouristicaUrl(hotelSlug);
    console.log(`🌐 Navigating to: ${url}`);
    
    try {
      await this.page!.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      
      // Wait a bit more for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.log('⚠️ Navigation timeout, trying with different wait strategy:', error);
      
      // Try again with a different wait strategy
      await this.page!.goto(url, { 
        waitUntil: 'load',
        timeout: 60000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Page loaded successfully (fallback)');
    }
  }

  private async extractHotelName(): Promise<string> {
    try {
      const hotelNameElement = await this.page!.$('h1, .hotel-name, .hotel-title');
      if (hotelNameElement) {
        const hotelName = await this.page!.evaluate(el => el.textContent?.trim(), hotelNameElement);
        return hotelName || 'Unknown Hotel';
      }
      
      // Fallback: try to extract from URL or page title
      const pageTitle = await this.page!.title();
      return pageTitle.replace(' - Touristica', '').replace(' | Touristica', '') || 'Unknown Hotel';
    } catch (error) {
      console.log('⚠️ Could not extract hotel name:', error);
      return 'Unknown Hotel';
    }
  }

  private async handlePopups(): Promise<void> {
    const popupSelectors = [
      '.modal .close',
      '.popup .close',
      '.overlay .close',
      '[data-dismiss="modal"]',
      '.btn-close',
      '.close-button',
      '.modal-header .close',
      '.fancybox-close',
      '.lightbox-close'
    ];

    let popupsClosed = 0;
    const maxPopups = 5;

    for (const selector of popupSelectors) {
      try {
        const popupElements = await this.page!.$$(selector);
        for (const popupElement of popupElements) {
          const isVisible = await popupElement.isVisible();
          if (isVisible) {
            const buttonText = await this.page!.evaluate(el => el.textContent?.trim().toLowerCase(), popupElement);
            if (buttonText && (buttonText.includes('join') || buttonText.includes('üye ol') || buttonText.includes('kayıt ol') || buttonText.includes('sign up'))) {
              console.log(`⚠️ Skipping button with text: "${buttonText}"`);
              continue;
            }
            
            console.log(`🚫 Found visible popup with selector: ${selector}`);
            await popupElement.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`✅ Closed popup: ${selector}`);
            popupsClosed++;
            
            if (popupsClosed >= maxPopups) {
              console.log('⚠️ Maximum popup close attempts reached');
              break;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error handling popup ${selector}:`, error);
      }
    }
  }

  private async selectDatesAndPersons(searchParams: SearchParams): Promise<void> {
    console.log('📅 Setting up search parameters...');
    
    try {
      // Wait for the search box to be visible
      await this.page!.waitForSelector('.search-box', { timeout: 10000 });
      
      // Wait a bit for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
             // Click on the date wrapper to open the datepicker
       try {
         const dateWrapper = await this.page!.$('.check-in-out-date-wrapper');
         if (dateWrapper) {
           await dateWrapper.click();
           await new Promise(resolve => setTimeout(resolve, 2000));
           
           // Wait for datepicker to be visible
           await this.page!.waitForSelector('.daterangepicker', { timeout: 5000 });
           
                       // Set check-in date by clicking on the calendar
            const checkInDate = new Date(searchParams.checkInDate);
            const checkInDay = checkInDate.getDate();
            const checkInMonth = checkInDate.getMonth();
            
            // Set check-out date
            const checkOutDate = new Date(searchParams.checkOutDate);
            const checkOutDay = checkOutDate.getDate();
            const checkOutMonth = checkOutDate.getMonth();
            
            // Determine which calendar to use for check-in (left = current month, right = next month)
            const currentMonth = new Date().getMonth();
            const checkInCalendar = checkInMonth === currentMonth ? 'left' : 'right';
            const checkOutCalendar = checkOutMonth === currentMonth ? 'left' : 'right';
            
            console.log(`📅 Check-in: ${checkInDay} (${checkInCalendar} calendar), Check-out: ${checkOutDay} (${checkOutCalendar} calendar)`);
            
            // Find and click the check-in date (first click)
            const checkInSelector = `.daterangepicker .drp-calendar.${checkInCalendar} tbody td[data-title*="r"][data-title*="c"]:not(.off):not(.disabled)`;
            const checkInCells = await this.page!.$$(checkInSelector);
            
            for (const cell of checkInCells) {
              const cellText = await this.page!.evaluate(el => el.textContent?.trim(), cell);
              if (cellText === checkInDay.toString()) {
                await (cell as any).click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(`✅ Clicked check-in date: ${checkInDay}`);
                break;
              }
            }
            
            // Find and click the check-out date (second click)
            const checkOutSelector = `.daterangepicker .drp-calendar.${checkOutCalendar} tbody td[data-title*="r"][data-title*="c"]:not(.off):not(.disabled)`;
            const checkOutCells = await this.page!.$$(checkOutSelector);
            
            for (const cell of checkOutCells) {
              const cellText = await this.page!.evaluate(el => el.textContent?.trim(), cell);
              if (cellText === checkOutDay.toString()) {
                await (cell as any).click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(`✅ Clicked check-out date: ${checkOutDay}`);
                break;
              }
            }
           
                       // Click "Uygula" (Apply) button
            const applyButton = await this.page!.$('.daterangepicker .applyBtn');
            if (applyButton) {
              await this.page!.evaluate(el => (el as HTMLElement).click(), applyButton);
              await new Promise(resolve => setTimeout(resolve, 2000));
              console.log('✅ Applied date selection');
            }
         }
       } catch (error) {
        console.log('⚠️ Could not set dates via datepicker, trying direct input method:', error);
        
        // Fallback: Set dates directly using JavaScript
        try {
          await this.page!.evaluate((date) => {
            const input = document.getElementById('txtCheckInDate') as HTMLInputElement;
            if (input) {
              input.value = date;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, this.formatDateForTouristica(searchParams.checkInDate));
          
          await this.page!.evaluate((date) => {
            const input = document.getElementById('txtCheckOutDate') as HTMLInputElement;
            if (input) {
              input.value = date;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, this.formatDateForTouristica(searchParams.checkOutDate));
        } catch (fallbackError) {
          console.log('⚠️ Could not set dates via direct input:', fallbackError);
        }
      }
      
      // Click on person selector to open it
      try {
                 const personInput = await this.page!.$('.person-count-input');
         if (personInput) {
           await personInput.click();
           await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Wait for person selector to be visible
          await this.page!.waitForSelector('.person-selector-box', { timeout: 5000 });
          
          // Set adults count
          await this.page!.evaluate((count) => {
            const select = document.getElementById('ddlAdultCount') as HTMLSelectElement;
            if (select) {
              select.value = count.toString();
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, searchParams.adults);
          
          // Set children count
          const childrenCount = searchParams.children || 0;
          await this.page!.evaluate((count) => {
            const select = document.getElementById('ddlChildCount') as HTMLSelectElement;
            if (select) {
              select.value = count.toString();
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, childrenCount);
          
          // Set child ages if children exist
          if (searchParams.children && searchParams.children > 0 && searchParams.childAges) {
            for (let i = 0; i < Math.min(searchParams.children, 2); i++) {
              await this.page!.evaluate((index, age) => {
                const selectId = index === 0 ? 'ddlFirstChildAge' : 'ddlSecondChildAge';
                const select = document.getElementById(selectId) as HTMLSelectElement;
                if (select) {
                  select.value = age.toString();
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, i, searchParams.childAges![i]);
            }
          }
          
          // Close person selector by clicking outside or on mobile button
          const mobileButton = await this.page!.$('.person-selector-box .mobile-button a');
          if (mobileButton) {
            await this.page!.evaluate(el => el.click(), mobileButton);
          } else {
            // Click outside to close
            await this.page!.click('body', { offset: { x: 0, y: 0 } });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.log('⚠️ Could not set person parameters via selector, trying direct method:', error);
        
        // Fallback: Set person parameters directly
        try {
          await this.page!.evaluate((count) => {
            const select = document.getElementById('ddlAdultCount') as HTMLSelectElement;
            if (select) {
              select.value = count.toString();
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, searchParams.adults);
          
          const childrenCount = searchParams.children || 0;
          await this.page!.evaluate((count) => {
            const select = document.getElementById('ddlChildCount') as HTMLSelectElement;
            if (select) {
              select.value = count.toString();
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, childrenCount);
          
          if (searchParams.children && searchParams.children > 0 && searchParams.childAges) {
            for (let i = 0; i < Math.min(searchParams.children, 2); i++) {
              await this.page!.evaluate((index, age) => {
                const selectId = index === 0 ? 'ddlFirstChildAge' : 'ddlSecondChildAge';
                const select = document.getElementById(selectId) as HTMLSelectElement;
                if (select) {
                  select.value = age.toString();
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, i, searchParams.childAges![i]);
            }
          }
        } catch (fallbackError) {
          console.log('⚠️ Could not set person parameters via direct method:', fallbackError);
        }
      }
      
      // Wait a bit for the form to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Click search button
      try {
                 const searchButton = await this.page!.$('.search-button');
         if (searchButton) {
           await searchButton.click();
           console.log('🔍 Search button clicked');
          
          // Wait for the page to load with results
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Wait for either nav-tabs-container or an error message
          try {
            await this.page!.waitForSelector('.nav-tabs-container', { timeout: 10000 });
          } catch (error) {
            console.log('⚠️ Nav tabs not found, checking if we need to wait longer');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } catch (error) {
        console.log('⚠️ Could not click search button:', error);
      }
      
      console.log('✅ Search parameters set successfully');
    } catch (error) {
      console.log('⚠️ Error setting search parameters:', error);
      throw error;
    }
  }

  private formatDateForTouristica(dateString: string): string {
    // Convert YYYY-MM-DD to DD.MM.YYYY format
    const [year, month, day] = dateString.split('-');
    return `${day}.${month}.${year}`;
  }

    private async extractOdalarVeFiyatlarData(): Promise<OdalarVeFiyatlarData[]> {
    console.log('🏨 Extracting ODALAR VE FİYATLAR data...');
    const odalarVeFiyatlar: OdalarVeFiyatlarData[] = [];
    
    try {
      // Wait for main navigation tabs to be visible
      await this.page!.waitForSelector('.nav-tabs-container', { timeout: 10000 });
      
      // Click on "ODALAR VE FİYATLAR" tab
      console.log('📋 Clicking on "ODALAR VE FİYATLAR" tab...');
      try {
        await this.page!.evaluate(() => {
          const tabs = document.querySelectorAll('.nav-tabs li a');
          for (let i = 0; i < tabs.length; i++) {
            const tabText = tabs[i].textContent?.trim();
            if (tabText === 'ODALAR VE FİYATLAR') {
              (tabs[i] as HTMLElement).click();
              return;
            }
          }
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Clicked on "ODALAR VE FİYATLAR" tab');
      } catch (error) {
        console.log('⚠️ Could not click on "ODALAR VE FİYATLAR" tab:', error);
        return [];
      }
      
      // Wait for the room availability items to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
             // Extract room availability data from the correct selector
       const roomItems = await this.page!.$$('.availability-item.v2.r1.from-rapid');
       console.log(`📋 Found ${roomItems.length} room availability items`);
       
       for (const item of roomItems) {
         try {
           // Extract room name from accommodation-type
           const roomNameElement = await item.$('.accommodation-type');
           const roomName = roomNameElement ? await this.page!.evaluate(el => el.textContent?.trim(), roomNameElement) : 'Unknown Room';
           
           // Extract board type from hotel-pension-type
           const boardElement = await item.$('.hotel-pension-type');
           const boardType = boardElement ? await this.page!.evaluate(el => el.textContent?.trim(), boardElement) : '';
           
           // Extract current price
           const priceElement = await item.$('.price-wrapper .price');
           const price = priceElement ? await this.page!.evaluate(el => {
             const priceText = el.textContent?.trim() || '';
             const smallElement = el.querySelector('small');
             const smallText = smallElement ? smallElement.textContent?.trim() : '';
             return priceText.replace(smallText || '', '').trim() + ' ' + smallText;
           }, priceElement) : '';
           
           // Extract old price
           const oldPriceElement = await item.$('.price-wrapper .old-price');
           const oldPrice = oldPriceElement ? await this.page!.evaluate(el => {
             const text = el.textContent?.trim() || '';
             // Remove the info icon text and keep only the price
             return text.replace(/[^\d\s,.]/g, '').trim();
           }, oldPriceElement) : '';
           
           // Extract discounts/offers
           const discountElements = await item.$$('.hotel-discount-v2');
           const discounts = [];
           for (const discountEl of discountElements) {
             const discountText = await this.page!.evaluate(el => el.textContent?.trim(), discountEl);
             if (discountText) {
               discounts.push(discountText);
             }
           }
           
           // Extract room capacity
           const capacityElement = await item.$('.room-capacity-text');
           const capacity = capacityElement ? await this.page!.evaluate(el => el.textContent?.trim(), capacityElement) : '';
           
           odalarVeFiyatlar.push({
             roomName: roomName || 'Unknown Room',
             availability: 'Available', // These items are available by default
             price: price || '',
             oldPrice,
             boardType: boardType || '',
             roomType: roomName || '', // Use room name as room type
             discounts: discounts.length > 0 ? discounts : undefined,
             capacity: capacity || undefined
           });
           
           console.log(`✅ Extracted ODALAR VE FİYATLAR data for: ${roomName} (${price})`);
         } catch (error) {
           console.log('⚠️ Error extracting room availability item:', error);
         }
       }
      
      console.log(`✅ Extracted ODALAR VE FİYATLAR data for ${odalarVeFiyatlar.length} rooms`);
      return odalarVeFiyatlar;
    } catch (error) {
      console.log('❌ Error extracting ODALAR VE FİYATLAR data:', error);
      return [];
    }
  }

  private async extractFiyatListesiData(): Promise<RoomData[]> {
    console.log('🏨 Extracting FİYAT LİSTESİ data...');
    const rooms: RoomData[] = [];
    
    try {
      // Click on "FİYAT LİSTESİ" tab
      console.log('📋 Clicking on "FİYAT LİSTESİ" tab...');
      try {
        await this.page!.evaluate(() => {
          const tabs = document.querySelectorAll('.nav-tabs li a');
          for (let i = 0; i < tabs.length; i++) {
            const tabText = tabs[i].textContent?.trim();
            if (tabText === 'FİYAT LİSTESİ') {
              (tabs[i] as HTMLElement).click();
              return;
            }
          }
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Clicked on "FİYAT LİSTESİ" tab');
      } catch (error) {
        console.log('⚠️ Could not click on "FİYAT LİSTESİ" tab:', error);
        return [];
      }
      
      // Wait for the secondary navigation (small scrollable tabs) to be visible
      await this.page!.waitForSelector('.nav-tabs.small.scrollable', { timeout: 10000 });
      
      // Get all room type tabs from the secondary navigation
      const roomTypeTabs = await this.page!.$$('.nav-tabs.small.scrollable li a');
      console.log(`📋 Found ${roomTypeTabs.length} room type tabs in secondary navigation`);
      
      for (let i = 0; i < roomTypeTabs.length; i++) {
        try {
          // Extract room type name first
          const roomTypeName = await this.page!.evaluate(el => el.textContent?.trim(), roomTypeTabs[i]);
          console.log(`🏠 Processing room type ${i + 1}: ${roomTypeName}`);
          
          // Click on the room type tab
          try {
            await this.page!.evaluate((index) => {
              const tabs = document.querySelectorAll('.nav-tabs.small.scrollable li a');
              if (tabs[index]) {
                (tabs[index] as HTMLElement).click();
              }
            }, i);
          } catch (clickError) {
            console.log(`⚠️ Could not click room type tab ${i + 1} via JavaScript, trying direct click`);
            await roomTypeTabs[i].click();
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Wait for price table to load
          try {
            await this.page!.waitForSelector('.table.table-bordered.price-list-table', { timeout: 10000 });
          } catch (tableError) {
            console.log(`⚠️ Price table not found for room type ${i + 1} (${roomTypeName}), skipping`);
            continue;
          }
          
          // Extract price periods and pricing info
          const pricePeriods = await this.extractPricePeriods();
          const pricingInfo = await this.extractPricingInfo();
          
          if (pricePeriods.length > 0 || pricingInfo.length > 0) {
            rooms.push({
              roomName: roomTypeName || `Room Type ${i + 1}`,
              pricePeriods,
              pricingInfo
            });
            
            console.log(`✅ Extracted FİYAT LİSTESİ data for room type: ${roomTypeName} (${pricePeriods.length} periods, ${pricingInfo.length} pricing entries)`);
          } else {
            console.log(`⚠️ No pricing data found for room type: ${roomTypeName}`);
          }
        } catch (error) {
          console.log(`⚠️ Error extracting data for room type ${i + 1}:`, error);
        }
      }
      
      console.log(`✅ Extracted FİYAT LİSTESİ data for ${rooms.length} room types`);
      return rooms;
    } catch (error) {
      console.log('❌ Error extracting FİYAT LİSTESİ data:', error);
      return [];
    }
  }

  private async extractPricePeriods(): Promise<PricePeriod[]> {
    const periods: PricePeriod[] = [];
    
    try {
      const periodCells = await this.page!.$$('.price-list-table tbody tr td:first-child');
      
      for (const cell of periodCells) {
        const cellText = await this.page!.evaluate(el => el.textContent?.trim(), cell);
        if (cellText) {
          const lines = cellText.split('\n').map(line => line.trim()).filter(line => line);
          
          if (lines.length >= 3) {
            const period = lines[0];
            const weekDays = lines[1].replace('week-days', '').trim();
            const minimumNights = lines[2];
            
            periods.push({
              period,
              weekDays,
              minimumNights
            });
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error extracting price periods:', error);
    }
    
    return periods;
  }

  private async extractPricingInfo(): Promise<PricingInfo[]> {
    const pricingInfo: PricingInfo[] = [];
    
    try {
      const rows = await this.page!.$$('.price-list-table tbody tr');
      
      for (const row of rows) {
        try {
          const cells = await row.$$('td');
          if (cells.length >= 8) {
            // Extract discount rate
            const discountCell = cells[1];
            const discountRate = await this.page!.evaluate(el => el.textContent?.trim(), discountCell) || '';
            
            // Extract board type
            const boardCell = cells[2];
            const boardType = await this.page!.evaluate(el => el.textContent?.trim(), boardCell) || '';
            
            // Extract double room prices
            const doubleRoomCell = cells[3];
            const doubleRoomOldPrice = await this.page!.evaluate(el => {
              const oldPriceEl = el.querySelector('.old-price');
              return oldPriceEl ? oldPriceEl.textContent?.trim() : '';
            }, doubleRoomCell) || '';
            const doubleRoomPrice = await this.page!.evaluate(el => {
              const priceEl = el.querySelector('.price');
              return priceEl ? priceEl.textContent?.trim() : '';
            }, doubleRoomCell) || '';
            
            // Extract single room prices
            const singleRoomCell = cells[4];
            const singleRoomOldPrice = await this.page!.evaluate(el => {
              const oldPriceEl = el.querySelector('.old-price');
              return oldPriceEl ? oldPriceEl.textContent?.trim() : '';
            }, singleRoomCell) || '';
            const singleRoomPrice = await this.page!.evaluate(el => {
              const priceEl = el.querySelector('.price');
              return priceEl ? priceEl.textContent?.trim() : '';
            }, singleRoomCell) || '';
            
            // Extract extra bed prices
            const extraBedCell = cells[5];
            const extraBedOldPrice = await this.page!.evaluate(el => {
              const oldPriceEl = el.querySelector('.old-price');
              return oldPriceEl ? oldPriceEl.textContent?.trim() : '';
            }, extraBedCell) || '';
            const extraBedPrice = await this.page!.evaluate(el => {
              const priceEl = el.querySelector('.price');
              return priceEl ? priceEl.textContent?.trim() : '';
            }, extraBedCell) || '';
            
            // Extract child policy
            const childCell = cells[6];
            const childPolicy = await this.page!.evaluate(el => el.textContent?.trim(), childCell) || '';
            
            // Extract installment link
            const installmentCell = cells[7];
            const installmentLink = await this.page!.evaluate(el => {
              const linkEl = el.querySelector('a');
              return linkEl ? linkEl.getAttribute('href') : '';
            }, installmentCell) || '';
            
            pricingInfo.push({
              discountRate,
              boardType,
              doubleRoomPrice,
              doubleRoomOldPrice,
              singleRoomPrice,
              singleRoomOldPrice,
              extraBedPrice,
              extraBedOldPrice,
              childPolicy,
              installmentLink
            });
          }
        } catch (error) {
          console.log('⚠️ Error extracting pricing info from row:', error);
        }
      }
    } catch (error) {
      console.log('⚠️ Error extracting pricing info:', error);
    }
    
    return pricingInfo;
  }

  async scrapeHotelDetails(hotelSlug: string, searchParams: SearchParams): Promise<ScrapedData | null> {
    try {
      console.log(`🎯 Starting to scrape hotel: ${hotelSlug}`);
      
      // Navigate to hotel page
      await this.navigateToHotelPage(hotelSlug);
      
      // Handle any popups
      await this.handlePopups();
      
      // Extract hotel name
      const hotelName = await this.extractHotelName();
      console.log(`🏨 Hotel name: ${hotelName}`);
      
      // Set search parameters
      await this.selectDatesAndPersons(searchParams);
      
      // Handle popups again after search
      await this.handlePopups();
      
      // Extract data from both tabs
      const odalarVeFiyatlar = await this.extractOdalarVeFiyatlarData();
      const fiyatListesi = await this.extractFiyatListesiData();
      
      if (odalarVeFiyatlar.length === 0 && fiyatListesi.length === 0) {
        console.log('❌ No data found in either tab');
        return null;
      }
      
      const scrapedData: ScrapedData = {
        hotelName,
        hotelSlug,
        searchParams,
        scrapedAt: new Date().toISOString(),
        odalarVeFiyatlar,
        fiyatListesi
      };
      
      console.log(`✅ Successfully scraped ${odalarVeFiyatlar.length} ODALAR VE FİYATLAR items and ${fiyatListesi.length} FİYAT LİSTESİ room types for ${hotelName}`);
      return scrapedData;
      
    } catch (error) {
      console.error('❌ Error scraping hotel details:', error);
      return null;
    }
  }

  async saveScrapedData(scrapedData: ScrapedData): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}_${scrapedData.hotelSlug}.json`;
      
      // Save to source directory (src/scrapedData/touristica)
      const srcDirPath = path.join(process.cwd(), 'src', 'scrapedData', 'touristica');
      if (!fs.existsSync(srcDirPath)) {
        fs.mkdirSync(srcDirPath, { recursive: true });
      }
      const srcFilePath = path.join(srcDirPath, fileName);
      fs.writeFileSync(srcFilePath, JSON.stringify(scrapedData, null, 2));
      
      // Also save to dist directory for consistency
      const distDirPath = path.join(process.cwd(), 'dist', 'scrapedData', 'touristica');
      if (!fs.existsSync(distDirPath)) {
        fs.mkdirSync(distDirPath, { recursive: true });
      }
      const distFilePath = path.join(distDirPath, fileName);
      fs.writeFileSync(distFilePath, JSON.stringify(scrapedData, null, 2));
      
      console.log(`💾 Data saved to: ${srcFilePath}`);
    } catch (error) {
      console.error('❌ Error saving scraped data:', error);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Touristica scraper closed');
    }
  }
} 