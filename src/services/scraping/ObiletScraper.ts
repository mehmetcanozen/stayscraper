import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

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
}

interface ScrapedData {
  hotelName: string;
  hotelId: string;
  searchParams: SearchParams;
  rooms: RoomData[];
  scrapedAt: string;
}

export class ObiletScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private hotelMappingPath: string;
  private hotelMapping: HotelMapping = {};

  constructor() {
    this.hotelMappingPath = path.join(process.cwd(), 'src', 'scrapedData', 'obilet', 'hotel_mapping.json');
    // Initialize with empty mapping, will be loaded in initialize()
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
   * Initialize browser and page
   */
  async initialize(): Promise<void> {
    try {
      // Load hotel mapping first
      await this.loadHotelMapping();
      
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 },
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
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('Obilet scraper initialized successfully');
    } catch (error: any) {
      console.error('Error initializing Obilet scraper:', error.message);
      throw error;
    }
  }

  /**
   * Discover hotel ID by searching for hotel name
   */
  async discoverHotelId(hotelName: string): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      console.log(`Searching for hotel ID: ${hotelName}`);

      // Navigate to Obilet hotel search page
      await this.page.goto('https://www.obilet.com/otel', { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find and fill the search input
      const searchInputSelector = '#origin-input';
      await this.page.waitForSelector(searchInputSelector);
      await this.page.click(searchInputSelector);
      await this.page.type(searchInputSelector, hotelName);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for dropdown suggestions and click on the first hotel result
      const hotelSuggestionSelector = '.item[data-value]:not([data-value="-1"])';
      await this.page.waitForSelector(hotelSuggestionSelector, { timeout: 5000 });
      
      // Click on the first hotel suggestion
      await this.page.click(hotelSuggestionSelector);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click the search button
      const searchButtonSelector = '#search-button';
      await this.page.waitForSelector(searchButtonSelector);
      await this.page.click(searchButtonSelector);
      await new Promise(resolve => setTimeout(resolve, 3000));

             // Wait for search results to load
       await new Promise(resolve => setTimeout(resolve, 3000));
       
       // Extract hotel ID directly from the search results page URL
       const currentUrl = this.page.url();
       console.log('Search results URL:', currentUrl);
       
       // Try different URL patterns to extract hotel ID
       let hotelIdMatch = currentUrl.match(/\/oteller\/[^-]+-(\d+)_/);
       if (!hotelIdMatch) {
         hotelIdMatch = currentUrl.match(/-(\d+)_/);
       }
      
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
   * Build Obilet URL with parameters
   */
  private buildObiletUrl(hotelName: string, hotelId: string, searchParams: SearchParams): string {
    const { checkInDate, checkOutDate, adults, children = 0, childAges = [] } = searchParams;
    
    // Format dates: YYYYMMDD-YYYYMMDD
    const formattedCheckIn = checkInDate.replace(/-/g, '');
    const formattedCheckOut = checkOutDate.replace(/-/g, '');
    const dateRange = `${formattedCheckIn}-${formattedCheckOut}`;
    
    // Build guest configuration
    let guestConfig = `${adults}ad`;
    if (children > 0 && childAges.length > 0) {
      guestConfig += `-${children}chld-${childAges.join('-')}`;
    }
    
    // Convert hotel name to URL-friendly format
    const hotelSlug = hotelName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
         // Use the correct URL pattern for hotel detail page
     return `https://www.obilet.com/otel-detay/${hotelSlug}-${hotelId}/${dateRange}/${guestConfig}`;
  }

  /**
   * Scrape hotel details using direct URL and API interception
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

      // Set up response listener BEFORE navigating
      const responses: any[] = [];
      this.page.on('response', async (response) => {
        const url = response.url();
        console.log(`Intercepted response: ${url}`);
        
        // Look for JSON responses containing room data (like 2ad-1chld-5.json or getoffersv2json)
        if ((url.includes('.json') && (url.includes('ad') || url.includes('chld'))) || 
            url.includes('getoffersv2json')) {
          console.log(`Found potential JSON response: ${url}`);
          try {
            const contentType = response.headers()['content-type'] || '';
            console.log(`Content-Type: ${contentType}`);
            if (contentType.includes('application/json')) {
              const responseData = await response.json();
              console.log(`Successfully parsed JSON response with keys:`, Object.keys(responseData));
              responses.push({
                url: url,
                data: responseData,
                status: response.status()
              });
              console.log(`API Response captured: ${url}`);
            }
          } catch (e) {
            console.error(`Error parsing JSON response from ${url}:`, e);
          }
        }
      });

      // Build URL and navigate
      const url = this.buildObiletUrl(hotelName, hotelId, searchParams);
      console.log(`Navigating to: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Look for room data in captured responses
      let roomData: RoomData[] = [];
      console.log(`Checking ${responses.length} captured responses for room data...`);
      for (const response of responses) {
        console.log(`Checking response: ${response.url}`);
        console.log(`Response data keys:`, response.data ? Object.keys(response.data) : 'No data');
        
        if (response.data && response.data.data && Array.isArray(response.data.data.rooms)) {
          console.log(`Found room data in API response: ${response.url}`);
          console.log(`Number of rooms found: ${response.data.data.rooms.length}`);
          const extractedRooms = this.extractRoomData(response.data);
          roomData.push(...extractedRooms);
          break;
        } else if (response.data && Array.isArray(response.data.rooms)) {
          console.log(`Found room data in direct response: ${response.url}`);
          console.log(`Number of rooms found: ${response.data.rooms.length}`);
          const extractedRooms = this.extractRoomData({ data: response.data });
          roomData.push(...extractedRooms);
          break;
        }
      }

      // If no room data found, try page reload and wait longer
      if (roomData.length === 0) {
        console.log('Room data not found in network requests, trying page reload...');
        
        // Reload page and wait for network idle
        await this.page.reload({ waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check responses again
        for (const response of responses) {
          if (response.data && response.data.data && Array.isArray(response.data.data.rooms)) {
            console.log(`Found room data in API response after reload: ${response.url}`);
            const extractedRooms = this.extractRoomData(response.data);
            roomData.push(...extractedRooms);
            break;
          }
        }
      }
      
      // If still no data, try DOM scraping as final fallback
      if (roomData.length === 0) {
        console.log('No JSON data captured, trying DOM scraping...');
        const domRooms = await this.scrapeRoomsFromDOM();
        roomData.push(...domRooms);
      }

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
   * Extract room data from API response
   */
  private extractRoomData(apiResponse: any): RoomData[] {
    const rooms: RoomData[] = [];
    
    if (apiResponse.data && apiResponse.data.rooms) {
      for (const room of apiResponse.data.rooms) {
        const roomData: RoomData = {
          roomName: room.name || '',
          displayName: room.displayName || '',
          roomSize: room.roomSize || 0,
          roomSizeUnit: room.roomSizeUnit || 'm2',
          price: room.offers?.[0]?.price?.amount || 0,
          currency: room.offers?.[0]?.price?.currency || 'TRY',
          boardType: room.offers?.[0]?.boardItem?.name || '',
          isRefundable: room.offers?.[0]?.isRefundable || false,
          attributes: room.attributes || [],
          mediaFiles: room.mediaFiles || [],
          offers: room.offers || []
        };
        rooms.push(roomData);
      }
    }
    
    return rooms;
  }

  /**
   * Fallback: Scrape room data from DOM
   */
  private async scrapeRoomsFromDOM(): Promise<RoomData[]> {
    if (!this.page) return [];

    try {
      const rooms = await this.page.evaluate(() => {
        const roomElements = document.querySelectorAll('.room-item, .hotel-room, [data-room]');
        const roomData: any[] = [];

        roomElements.forEach((element) => {
          const roomName = element.querySelector('.room-name, .room-title')?.textContent?.trim() || '';
          const priceElement = element.querySelector('.price, .room-price');
          const priceText = priceElement?.textContent || '';
          const price = priceText ? parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) : 0;
          
          roomData.push({
            roomName,
            displayName: roomName,
            roomSize: 0,
            roomSizeUnit: 'm2',
            price,
            currency: 'TRY',
            boardType: '',
            isRefundable: false,
            attributes: [],
            mediaFiles: [],
            offers: []
          });
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
      
      const dir = path.join(process.cwd(), 'src', 'scrapedData', 'obilet');
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
      console.log('Obilet scraper closed');
    }
  }
} 