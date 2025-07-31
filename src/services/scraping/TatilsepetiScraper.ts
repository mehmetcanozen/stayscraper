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

export class TatilsepetiScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly baseUrl = 'https://www.tatilsepeti.com';

  constructor() {
    console.log('🏨 Tatilsepeti scraper created');
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
      
      console.log('✅ Tatilsepeti scraper initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Tatilsepeti scraper:', error);
      throw error;
    }
  }

  private buildUrl(params: SearchParams): string {
    const hotelSlug = params.hotelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Build oda parameter
    let odaParam = params.adults.toString();
    if (params.children > 0 && params.childAges && params.childAges.length > 0) {
      odaParam += '-' + params.childAges.join('-');
    }
    
    const url = `${this.baseUrl}/${hotelSlug}?ara=oda:${odaParam};tarih:${params.checkInDate},${params.checkOutDate}`;
    console.log(`🔗 Built URL: ${url}`);
    return url;
  }

  async searchHotels(params: SearchParams): Promise<void> {
    console.log('🔍 Starting Tatilsepeti search flow...');
    
    try {
      // Build URL with all parameters
      const url = this.buildUrl(params);
      
      // Navigate directly to the hotel page with search parameters
      console.log(`🏨 Navigating to: ${url}`);
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Handle any popups that might appear
      await this.handlePopups();
      
      console.log('✅ Search flow completed successfully!');
      
    } catch (error) {
      console.error('❌ Search flow failed:', error);
      throw error;
    }
  }

  private async handlePopups(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Wait a bit for popups to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to close modal popups
      const popupSelectors = [
        '.modal-content .close',
        '.modal-content .close-button',
        'button[data-dismiss="modal"]',
        '.close[aria-label="Close"]'
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

  /**
   * NORMAL SCRAPING - Gets basic room data from room cards WITHOUT opening modals
   * 
   * This method extracts:
   * - Room names, sizes, features, concepts
   * - Basic prices (total, discounted, discount percentage)
   * - Room capacity and availability
   * - All data visible on the room cards themselves
   * 
   * Use this when you only need basic room information without detailed pricing breakdowns.
   * This is faster and more reliable as it doesn't interact with modals.
   */
  async scrapeHotelDetails(): Promise<ScrapedHotelData> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔍 Starting NORMAL hotel details scraping (no modals)...');
    
    try {
      // Wait for room results to load
      await this.page.waitForSelector('#dev-roomList', { timeout: 15000 });
      
      // Get hotel name from page title or content
      const hotelName = await this.page.$eval('h1, .hotel-name, title', el => {
        const text = el.textContent?.trim() || '';
        return text.replace(' | Tatilsepeti', '').replace(' - Tatilsepeti', '');
      }).catch(() => 'Unknown Hotel');
      
      console.log(`🏨 Scraping basic details for: ${hotelName}`);
      
      // Extract room data from cards WITHOUT opening any modals
      const rooms = await this.page.$$eval('.Hotel__Details--Card', async (roomElements) => {
         const roomData = [];
         
         // Filter out modal elements - only process cards that are not inside modals
         const validRoomElements = Array.from(roomElements).filter(el => {
           // Check if the element is inside a modal
           const isInModal = el.closest('.modal-content, .modal-dialog, .modal') !== null;
           // Check if it has a data-card-type attribute (main room cards have this)
           const hasCardType = el.hasAttribute('data-card-type');
           // Check if it has a header with title (main room cards have this)
           const hasHeader = el.querySelector('.Header--Title, .Section--Title') !== null;
           
           return !isInModal && hasCardType && hasHeader;
         });
         
         for (let i = 0; i < validRoomElements.length; i++) {
           const roomElement = validRoomElements[i];
           try {
             // Room name - try multiple selectors
             let name = 'Unknown Room';
             const nameSelectors = [
               '.Header--Title',
               '.Section--Title', 
               'h1',
               '.modal-title'
             ];
             
             for (const selector of nameSelectors) {
               const nameElement = roomElement.querySelector(selector);
               if (nameElement && nameElement.textContent?.trim()) {
                 name = nameElement.textContent.trim();
                 break;
               }
             }
             
             // Room size - try multiple approaches
             let size = 'Unknown';
             const sizeSelectors = [
               '[data-id="roomSquareMeter"]',
               '.roomDetailInfo strong[data-id="roomSquareMeter"]',
               '.roomDetailInfo span[data-a*="m2"]'
             ];
             
             for (const selector of sizeSelectors) {
               const sizeElement = roomElement.querySelector(selector);
               if (sizeElement && sizeElement.textContent?.trim()) {
                 size = sizeElement.textContent.trim();
                 break;
               }
             }
             
             // If still unknown, try to extract from data-a attribute
             if (size === 'Unknown') {
               const sizeAttrElement = roomElement.querySelector('.roomDetailInfo[data-original-title*="m2"]');
               if (sizeAttrElement) {
                 const title = sizeAttrElement.getAttribute('data-original-title');
                 if (title && title.includes('m2')) {
                   size = title;
                 }
               }
             }
             
             // Room features - more comprehensive approach
             const featureElements = roomElement.querySelectorAll('.roomDetailInfo span');
             let features = Array.from(featureElements).map(el => el.textContent?.trim()).filter(Boolean);
             
             // If no features found, try alternative selectors
             if (features.length === 0) {
               const altFeatureElements = roomElement.querySelectorAll('.roomDetailInfo');
               features = Array.from(altFeatureElements).map(el => {
                 const text = el.textContent?.trim();
                 // Skip if it's the size info
                 if (text && !text.includes('m2') && !text.includes('Oda Genişliği')) {
                   return text;
                 }
                 return '';
               }).filter(text => text !== '');
             }
             
             // Concept/Board type - try multiple selectors
             let concept = 'Unknown';
             const conceptSelectors = [
               '.Details--Title',
               '.Card__Section--Amenities h3',
               '.amenities h3'
             ];
             
             for (const selector of conceptSelectors) {
               const conceptElement = roomElement.querySelector(selector);
               if (conceptElement && conceptElement.textContent?.trim()) {
                 concept = conceptElement.textContent.trim();
                 break;
               }
             }
             
             // Prices - try multiple selectors
             let totalPrice = '';
             let discountedPrice = '';
             let discount = '';
             
             const totalPriceElement = roomElement.querySelector('.Prices--Total');
             if (totalPriceElement) {
               totalPrice = totalPriceElement.textContent?.trim() || '';
             }
             
             const discountedPriceElement = roomElement.querySelector('.Prices--Price');
             if (discountedPriceElement) {
               discountedPrice = discountedPriceElement.textContent?.trim() || '';
             }
             
             const discountElement = roomElement.querySelector('.Prices--Discount');
             if (discountElement) {
               discount = discountElement.textContent?.trim() || '';
             }
             
             // Room capacity - try multiple selectors
             let capacity = '';
             const capacitySelectors = [
               '.Header--Description span',
               '.Section--Description span',
               '.Header--Description',
               '.Section--Description'
             ];
             
             for (const selector of capacitySelectors) {
               const capacityElement = roomElement.querySelector(selector);
               if (capacityElement && capacityElement.textContent?.trim()) {
                 capacity = capacityElement.textContent.trim();
                 break;
               }
             }
             
             // Check if room has availability issues
             const hasError = roomElement.querySelector('.rightSideError, .hotelDetailYellowError, .mobilShowError') !== null;
             
             roomData.push({
               name,
               size,
               features,
               concept,
               totalPrice,
               discountedPrice,
               discount,
               capacity,
               hasError,
               available: !hasError
             });
             
           } catch (error) {
             console.error('Error extracting room data:', error);
           }
         }
         
         return roomData;
       });
      
      console.log(`✅ Successfully extracted ${rooms.length} rooms`);
      
      return {
        success: true,
        hotelName,
        rooms,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to scrape hotel details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        scrapedAt: new Date().toISOString()
      };
    }
  }

  /**
   * DETAILED SCRAPING - Opens modals to get comprehensive pricing data
   * 
   * This method:
   * - Clicks "Tüm Fiyatları Görüntüle" buttons to open modals
   * - Extracts detailed pricing breakdowns (period-based pricing, per-person costs)
   * - Gets children pricing, extra bed costs, single/double occupancy rates
   * - Handles modal opening/closing for each room
   * 
   * Use this when you need comprehensive pricing data including:
   * - Period-based pricing (different rates for different date ranges)
   * - Per-person daily costs
   * - Children pricing breakdowns
   * - Extra bed costs
   * - Single vs double occupancy rates
   * 
   * WARNING: This method is slower and more complex as it interacts with modals.
   * For basic room information, use scrapeHotelDetails() instead.
   */
  async scrapeDetailedPrices(): Promise<any[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('💰 Starting DETAILED price scraping (with modals)...');
    
    try {
      const detailedPrices = [];
      
      // Find all "Tüm Fiyatları Görüntüle" buttons that open detailed pricing modals
      const priceButtons = await this.page.$$('.Section--AllPrices');
       
       console.log(`Found ${priceButtons.length} price buttons`);
       
       for (let i = 0; i < priceButtons.length; i++) {
         try {
           console.log(`\n🔍 Processing room ${i + 1}...`);
           
           // First, ensure any existing modal is completely closed
           await this.ensureModalClosed();
           
           const button = priceButtons[i];
           
           // Scroll button into view and ensure it's clickable
           await button.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
           await new Promise(resolve => setTimeout(resolve, 1000));
           
           // Check if button is visible and clickable
           const isVisible = await button.evaluate(el => {
             const rect = el.getBoundingClientRect();
             return rect.width > 0 && rect.height > 0 && 
                    window.getComputedStyle(el).visibility !== 'hidden' &&
                    window.getComputedStyle(el).display !== 'none';
           });
           
           if (!isVisible) {
             console.log(`⚠️ Button ${i} is not visible, skipping...`);
             continue;
           }
           
           // Click the button to open modal
           console.log(`🖱️ Clicking price button for room ${i + 1}...`);
           await button.click();
           await new Promise(resolve => setTimeout(resolve, 3000));
           
                      // Wait for modal to appear
           await this.page.waitForSelector('.modal-content', { timeout: 5000 });
           
           // Extract modal title and additional info
           const modalInfo = await this.page.$eval('.modal-content', (modal) => {
             const title = modal.querySelector('.modal-title')?.textContent?.trim() || '';
             const alert = modal.querySelector('.alert')?.textContent?.trim() || '';
             
             return {
               title,
               alert,
               modalType: 'detailed-pricing'
             };
           });
           
           console.log(`📋 Processing modal for room ${i + 1}: ${modalInfo.title}`);
           
           // Extract comprehensive price table data
           const priceData = await this.page.$eval('.all-price-table', (table) => {
             const rows = table.querySelectorAll('tbody tr');
             const prices = [];
             
             for (const row of rows) {
               const cells = row.querySelectorAll('td');
               if (cells.length >= 4) {
                 // Period (date range)
                 const period = cells[0]?.textContent?.trim() || '';
                 
                 // Price type and conditions
                 const type = cells[1]?.textContent?.trim() || '';
                 
                 // Double occupancy price (per person)
                 const doublePriceElement = cells[2]?.querySelector('.price');
                 const doublePrice = doublePriceElement ? doublePriceElement.textContent?.trim() || '' : cells[2]?.textContent?.trim() || '';
                 
                 // Single occupancy price
                 const singlePriceElement = cells[3]?.querySelector('.price');
                 const singlePrice = singlePriceElement ? singlePriceElement.textContent?.trim() || '' : cells[3]?.textContent?.trim() || '';
                 
                 // Extra bed price
                 const extraBedElement = cells[4]?.querySelector('.price');
                 const extraBed = extraBedElement ? extraBedElement.textContent?.trim() || '' : cells[4]?.textContent?.trim() || '';
                 
                 // Children pricing details
                 const childrenTable = cells[5]?.querySelector('table');
                 const childrenPricing = [];
                 
                 if (childrenTable) {
                   const childRows = childrenTable.querySelectorAll('tbody tr');
                   for (const childRow of childRows) {
                     const childCells = childRow.querySelectorAll('td');
                     if (childCells.length >= 3) {
                       const childNumber = childCells[0]?.textContent?.trim() || '';
                       const childAge = childCells[1]?.textContent?.trim() || '';
                       const childPrice = childCells[2]?.textContent?.trim() || '';
                       
                       childrenPricing.push({
                         childNumber,
                         childAge,
                         childPrice
                       });
                     }
                   }
                 }
                 
                 // Raw cell content for debugging
                 const rawChildren = cells[5]?.textContent?.trim() || '';
                 
                 prices.push({
                   period,
                   type,
                   doublePrice,
                   singlePrice,
                   extraBed,
                   childrenPricing,
                   rawChildren,
                   // Additional metadata
                   hasChildrenTable: childrenTable !== null,
                   totalCells: cells.length
                 });
               }
             }
             
             return prices;
           });
          
                     detailedPrices.push({
             roomIndex: i,
             modalInfo,
             prices: priceData
           });
          
                     // Close modal using the exact button selector
           await this.closeModal();
           
         } catch (error) {
           console.error(`Error scraping detailed prices for room ${i}:`, error);
           // Try to close modal even if scraping failed
           await this.closeModal();
         }
       }
       
       console.log(`✅ Successfully scraped detailed prices for ${detailedPrices.length} rooms`);
       return detailedPrices;
       
     } catch (error) {
       console.error('❌ Failed to scrape detailed prices:', error);
       return [];
     }
   }

   async saveScrapedData(data: ScrapedHotelData, searchParams: SearchParams): Promise<string> {
    try {
      const tatilsepetiDir = path.join(process.cwd(), 'src', 'scrapedData', 'tatilsepeti');
      await fs.mkdir(tatilsepetiDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const hotelNameSlug = data.hotelName?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'unknown_hotel';
      const filename = `${timestamp}_${hotelNameSlug}.json`;
      const filepath = path.join(tatilsepetiDir, filename);
      
      const dataToSave = {
        ...data,
        scrapedAt: new Date().toISOString(),
        searchParams: searchParams,
        scraper: 'TatilsepetiScraper'
      };
      
      await fs.writeFile(filepath, JSON.stringify(dataToSave, null, 2), 'utf8');
      console.log(`✅ Scraped data saved to: ${filepath}`);
      return filepath;
      
    } catch (error) {
      console.error('❌ Failed to save scraped data:', error);
      throw error;
    }
  }

   private async ensureModalClosed(): Promise<void> {
     if (!this.page) return;
     
     try {
       // Check if there's an existing modal
       const existingModal = await this.page.$('.modal-content');
       if (existingModal) {
         console.log('⚠️ Found existing modal, closing it first...');
         await this.closeModal();
       }
     } catch (error) {
       // Continue if no modal found
     }
   }

   private async closeModal(): Promise<void> {
     if (!this.page) return;
     
     try {
       // Wait a bit for modal to fully load
       await new Promise(resolve => setTimeout(resolve, 500));
       
       // Try multiple close button selectors
       const closeSelectors = [
         'button.close.allPricesModalClose[data-dismiss="modal"]',
         '.allPricesModalClose',
         '.modal-content .close',
         'button[data-dismiss="modal"]',
         '.close[aria-label="Close"]',
         '.modal-header .close'
       ];
       
       let modalClosed = false;
       for (const selector of closeSelectors) {
         try {
           const closeButton = await this.page.$(selector);
           if (closeButton) {
             await closeButton.click();
             console.log(`✅ Closed modal with selector: ${selector}`);
             modalClosed = true;
             break;
           }
         } catch (error) {
           // Continue to next selector
         }
       }
       
       // If no close button found, try pressing Escape key
       if (!modalClosed) {
         await this.page.keyboard.press('Escape');
         console.log('✅ Closed modal with Escape key');
       }
       
       // Wait for modal to disappear
       await new Promise(resolve => setTimeout(resolve, 1500));
       
       // Verify modal is closed by checking if it's still visible
       const modalStillVisible = await this.page.$('.modal-content');
       if (modalStillVisible) {
         console.log('⚠️ Modal still visible after closing attempt, trying Escape again...');
         await this.page.keyboard.press('Escape');
         await new Promise(resolve => setTimeout(resolve, 1000));
       }
       
     } catch (error) {
       console.error('Error closing modal:', error);
       // Try one more time with Escape key
       try {
         await this.page.keyboard.press('Escape');
         await new Promise(resolve => setTimeout(resolve, 1000));
       } catch (escapeError) {
         console.error('Failed to close modal with Escape key:', escapeError);
       }
     }
   }

   async close(): Promise<void> {
     if (this.browser) {
       await this.browser.close();
       console.log('✅ Tatilsepeti scraper closed');
     }
   }
} 