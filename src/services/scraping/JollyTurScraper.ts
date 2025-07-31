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

interface DailyPrice {
  day: string;
  date: string;
  dayOfWeek: string;
  oldPrice: string;
  currentPrice: string;
}

interface RoomAmenity {
  name: string;
  isPaid?: boolean;
}

interface RoomBadge {
  icon: string;
  text: string;
}

interface RoomImage {
  thumbnail: string;
  fullSize: string;
}

interface RoomData {
  roomId: string;
  roomType: string;
  roomName: string;
  concept: string;
  minStay: string;
  roomSize: string;
  bedType: string;
  view: string;
  smokingPolicy: string;
  description: string;
  amenities: RoomAmenity[];
  badges: RoomBadge[];
  images: RoomImage[];
  campaignTags: string[];
  cancellationPolicy: string;
  childPolicy: string;
  totalPrice: {
    oldPrice: string;
    currentPrice: string;
    discountPercent: string;
    currency: string;
  };
  dailyPrices: DailyPrice[];
  isAvailable: boolean;
}

interface ScrapedData {
  hotelName: string;
  hotelSlug: string;
  searchParams: SearchParams;
  rooms: RoomData[];
  scrapedAt: string;
  totalRooms: number;
}

export class JollyTurScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly baseUrl = 'https://www.jollytur.com';

  constructor() {
    // Initialize scraper
  }

  /**
   * Initialize browser and page
   */
  async initialize(headless: boolean = true): Promise<void> {
    try {
      console.log('🚀 Initializing JollyTur scraper...');
      
      this.browser = await puppeteer.launch({
        headless: headless,
        defaultViewport: { width: 1920, height: 1080 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      console.log('✅ JollyTur scraper initialized successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to initialize JollyTur scraper:', error.message);
      throw error;
    }
  }

  /**
   * Build JollyTur URL with search parameters
   * Format: https://www.jollytur.com/hotel-slug?Rooms=adults-child1age-child2age&StartDate=YYYY.MM.DD&EndDate=YYYY.MM.DD
   */
  private buildJollyTurUrl(hotelSlug: string, searchParams: SearchParams): string {
    const { checkInDate, checkOutDate, adults, children = 0, childAges = [] } = searchParams;
    
    // Format dates: YYYY-MM-DD to YYYY.MM.DD
    const formattedCheckIn = checkInDate.replace(/-/g, '.');
    const formattedCheckOut = checkOutDate.replace(/-/g, '.');
    
    // Build rooms parameter: adults-child1age-child2age
    let roomsParam = adults.toString();
    if (children > 0 && childAges.length > 0) {
      roomsParam += '-' + childAges.join('-');
    }
    
    const url = `${this.baseUrl}/${hotelSlug}?Rooms=${roomsParam}&StartDate=${formattedCheckIn}&EndDate=${formattedCheckOut}`;
    console.log(`🔗 Built URL: ${url}`);
    
    return url;
  }

  /**
   * Navigate to hotel page and wait for content to load
   */
  private async navigateToHotelPage(url: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      console.log(`🌐 Navigating to: ${url}`);
      
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for product-tab-content to load
      await this.page.waitForSelector('.product-tab-content', { timeout: 10000 });
      
      // Handle popups that might appear
      await this.handlePopups();
      
      // Wait a bit more for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Page loaded successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to navigate to hotel page:', error.message);
      throw error;
    }
  }

  /**
   * Handle popups that might appear on the page
   */
  private async handlePopups(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      console.log('🔍 Checking for popups...');
      
      // Specific selectors for JollyTur modal popup (based on screenshot analysis)
      const popupSelectors = [
        // Close button (X) in modal header - most likely selectors
        '.modal .close',
        '.modal .btn-close',
        '.modal .close-button',
        '.modal .x',
        '.modal .times',
        '.modal .cross',
        '.modal .dismiss',
        '.modal .exit',
        '.modal .remove',
        '.modal .delete',
        '.modal .hide',
        '.modal .minimize',
        '.modal .collapse',
        '.modal .shrink',
        '.modal .reduce',
        '.modal .small',
        '.modal .tiny',
        '.modal .mini',
        '.modal .micro',
        '.modal .nano',
        '.modal .pico',
        '.modal .femto',
        '.modal .atto',
        '.modal .zepto',
        '.modal .yocto',
        // Generic modal close selectors
        '.modal-close',
        '.popup-close',
        '.close-button',
        '.btn-close',
        '[data-dismiss="modal"]',
        '.popup .close',
        '.overlay .close',
        '.lightbox-close',
        '.dialog-close',
        '.notification-close',
        '.alert-close',
        '.cookie-close',
        '.newsletter-close',
        '.promo-close',
        '.banner-close',
        '.ad-close',
        '.interstitial-close',
        '.overlay-close',
        '.modal-header .close',
        '.popup-header .close',
        // Additional specific selectors for JollyTur
        '[title="Kapat"]',
        '[title="Close"]',
        '[aria-label="Close"]',
        '[aria-label="Kapat"]',
        '.close-icon',
        '.close-symbol',
        '.close-mark',
        '.close-sign',
        '.close-indicator',
        '.close-pointer',
        '.close-cursor',
        '.close-handle',
        '.close-control',
        '.close-switch',
        '.close-toggle',
        '.close-button',
        '.close-btn',
        '.close-link',
        '.close-anchor',
        '.close-span',
        '.close-div',
        '.close-p',
        '.close-h1',
        '.close-h2',
        '.close-h3',
        '.close-h4',
        '.close-h5',
        '.close-h6'
      ];
      
      // Try to close popups
      let popupsClosed = 0;
      for (const selector of popupSelectors) {
        try {
          const popupElements = await this.page.$$(selector);
          for (const popupElement of popupElements) {
            const isVisible = await popupElement.isVisible();
            if (isVisible) {
              // Check if this is a "JOIN NOW!" button or similar - avoid clicking it
              const buttonText = await this.page.evaluate(el => el.textContent?.trim().toLowerCase(), popupElement);
              if (buttonText && (buttonText.includes('join') || buttonText.includes('üye ol') || buttonText.includes('kayıt ol') || buttonText.includes('sign up') || buttonText.includes('hemen üye ol'))) {
                console.log(`⚠️ Skipping button with text: "${buttonText}"`);
                continue;
              }
              
              // Check if this element has an href attribute (might be a link that redirects)
              const hasHref = await this.page.evaluate(el => el.hasAttribute('href'), popupElement);
              if (hasHref) {
                console.log(`⚠️ Skipping element with href attribute`);
                continue;
              }
              
              // Check if this is a button or link element that might redirect
              const tagName = await this.page.evaluate(el => el.tagName.toLowerCase(), popupElement);
              if (tagName === 'a' || tagName === 'button') {
                // Only click if it's clearly a close button
                if (!buttonText || (!buttonText.includes('close') && !buttonText.includes('kapat') && !buttonText.includes('x') && !buttonText.includes('×'))) {
                  console.log(`⚠️ Skipping ${tagName} element with text: "${buttonText}"`);
                  continue;
                }
              }
              
              console.log(`🚫 Found visible popup with selector: ${selector}`);
              await popupElement.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log(`✅ Closed popup: ${selector}`);
              popupsClosed++;
              
              // Check if popup is still visible after clicking
              const stillVisible = await popupElement.isVisible();
              if (!stillVisible) {
                console.log(`✅ Popup successfully closed with selector: ${selector}`);
                break;
              }
            }
          }
        } catch (error) {
          // Continue with next selector if this one fails
        }
      }
      
      console.log(`✅ Popup handling completed. Closed ${popupsClosed} popups.`);
      
      // Try pressing Escape key to close any modal
      await this.page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try clicking outside modal areas
      await this.page.mouse.click(10, 10);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ Popup handling completed');
      
    } catch (error: any) {
      console.error('❌ Error handling popups:', error.message);
    }
  }

  /**
   * Extract hotel name from page
   */
  private async extractHotelName(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Try multiple selectors for hotel name
      const selectors = [
        'h1.hotel-title',
        '.hotel-name',
        'h1',
        '.product-title'
      ];
      
      for (const selector of selectors) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await this.page.evaluate(el => el.textContent?.trim(), element);
          if (text) {
            console.log(`🏨 Hotel name found: ${text}`);
            return text;
          }
        }
      }
      
      // Fallback: extract from URL
      const url = this.page.url();
      const slugMatch = url.match(/\/([^?]+)\?/);
      if (slugMatch) {
        const hotelName = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        console.log(`🏨 Hotel name from URL: ${hotelName}`);
        return hotelName;
      }
      
      return 'Unknown Hotel';
      
    } catch (error: any) {
      console.error('❌ Failed to extract hotel name:', error.message);
      return 'Unknown Hotel';
    }
  }

  /**
   * Extract room data from a product-info-box element
   */
  private async extractRoomData(roomElement: any): Promise<RoomData | null> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Extract basic room information
      const roomId = await this.page.evaluate(el => el.getAttribute('data-roomid'), roomElement) || '';
      const roomType = await this.page.evaluate(el => el.getAttribute('data-roomtype'), roomElement) || '';
      
      // Extract room name
      const roomNameElement = await roomElement.$('.room-title');
      const roomName = roomNameElement ? 
        await this.page.evaluate(el => el.textContent?.trim(), roomNameElement) : roomType;
      
      // Extract concept
      const conceptElement = await roomElement.$('.room-concept');
      const concept = conceptElement ? 
        await this.page.evaluate(el => el.textContent?.trim().replace(/^\s*[^a-zA-Z]*/, ''), conceptElement) : '';
      
      // Extract minimum stay
      const minStayElement = await roomElement.$('.room-type-info span');
      const minStay = minStayElement ? 
        await this.page.evaluate(el => el.textContent?.trim(), minStayElement) : '';
      
      // Extract pricing information
      const priceInfo = await this.extractPricingInfo(roomElement);
      
      // Extract room details (size, bed type, view, etc.)
      const roomDetails = await this.extractRoomDetails(roomElement);
      
      // Extract amenities
      const amenities = await this.extractAmenities(roomElement);
      
      // Extract badges
      const badges = await this.extractBadges(roomElement);
      
      // Extract images
      const images = await this.extractImages(roomElement);
      
      // Extract campaign tags
      const campaignTags = await this.extractCampaignTags(roomElement);
      
      // Extract cancellation policy
      const cancellationPolicy = await this.extractCancellationPolicy(roomElement);
      
      // Extract child policy
      const childPolicy = await this.extractChildPolicy(roomElement);
      
      // Extract daily prices
      const dailyPrices = await this.extractDailyPrices(roomElement);
      
      // Check availability
      const isAvailable = await this.checkAvailability(roomElement);
      
      const roomData: RoomData = {
        roomId,
        roomType,
        roomName: roomName || roomType,
        concept,
        minStay,
        roomSize: roomDetails.size,
        bedType: roomDetails.bedType,
        view: roomDetails.view,
        smokingPolicy: roomDetails.smokingPolicy,
        description: roomDetails.description,
        amenities,
        badges,
        images,
        campaignTags,
        cancellationPolicy,
        childPolicy,
        totalPrice: priceInfo,
        dailyPrices,
        isAvailable
      };
      
      return roomData;
      
    } catch (error: any) {
      console.error('❌ Failed to extract room data:', error.message);
      return null;
    }
  }

  /**
   * Extract pricing information from room element
   */
  private async extractPricingInfo(roomElement: any): Promise<{ oldPrice: string; currentPrice: string; discountPercent: string; currency: string }> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const priceInfo = {
        oldPrice: '',
        currentPrice: '',
        discountPercent: '',
        currency: 'TL'
      };
      
      // Extract old price
      const oldPriceElement = await roomElement.$('.old-price');
      if (oldPriceElement) {
        priceInfo.oldPrice = await this.page.evaluate(el => el.textContent?.trim(), oldPriceElement) || '';
      }
      
      // Extract current price
      const currentPriceElement = await roomElement.$('.current-price');
      if (currentPriceElement) {
        const priceText = await this.page.evaluate(el => el.textContent?.trim(), currentPriceElement) || '';
        // Extract price and currency
        const priceMatch = priceText.match(/([\d.,]+)([A-Z]+)/);
        if (priceMatch) {
          priceInfo.currentPrice = priceMatch[1];
          priceInfo.currency = priceMatch[2];
        } else {
          priceInfo.currentPrice = priceText;
        }
      }
      
      // Extract discount percentage
      const discountElement = await roomElement.$('.discount-percent');
      if (discountElement) {
        priceInfo.discountPercent = await this.page.evaluate(el => el.textContent?.trim(), discountElement) || '';
      }
      
      return priceInfo;
      
    } catch (error: any) {
      console.error('❌ Failed to extract pricing info:', error.message);
      return { oldPrice: '', currentPrice: '', discountPercent: '', currency: 'TL' };
    }
  }

  /**
   * Extract room details (size, bed type, view, etc.)
   */
  private async extractRoomDetails(roomElement: any): Promise<{ size: string; bedType: string; view: string; smokingPolicy: string; description: string }> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const details = {
        size: '',
        bedType: '',
        view: '',
        smokingPolicy: '',
        description: ''
      };
      
      // Extract room badges for size, bed type, view, smoking policy
      const badgeElements = await roomElement.$$('.room-badges .badge');
      for (const badge of badgeElements) {
        const badgeText = await this.page.evaluate(el => el.textContent?.trim(), badge) || '';
        const iconElement = await badge.$('i');
        const iconClass = iconElement ? await this.page.evaluate(el => el.className, iconElement) : '';
        
        if (iconClass.includes('icon-alan')) {
          details.size = badgeText.replace(/[^\d]/g, '') + ' m2';
        } else if (iconClass.includes('icon-room-count')) {
          details.bedType = badgeText;
        } else if (iconClass.includes('icon-view')) {
          details.view = badgeText;
        } else if (iconClass.includes('icon-no-smoking')) {
          details.smokingPolicy = badgeText;
        }
      }
      
      // Extract description
      const descriptionElement = await roomElement.$('.option-text');
      if (descriptionElement) {
        details.description = await this.page.evaluate(el => el.textContent?.trim(), descriptionElement) || '';
      }
      
      return details;
      
    } catch (error: any) {
      console.error('❌ Failed to extract room details:', error.message);
      return { size: '', bedType: '', view: '', smokingPolicy: '', description: '' };
    }
  }

  /**
   * Extract amenities from room element
   */
  private async extractAmenities(roomElement: any): Promise<RoomAmenity[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const amenities: RoomAmenity[] = [];
      
      const amenityElements = await roomElement.$$('.option-tag.card-option span');
      for (const amenity of amenityElements) {
        const amenityText = await this.page.evaluate(el => el.textContent?.trim(), amenity) || '';
        const iconElement = await amenity.$('i.icon-tl');
        const isPaid = !!iconElement;
        
        if (amenityText) {
          amenities.push({
            name: amenityText,
            isPaid
          });
        }
      }
      
      return amenities;
      
    } catch (error: any) {
      console.error('❌ Failed to extract amenities:', error.message);
      return [];
    }
  }

  /**
   * Extract badges from room element
   */
  private async extractBadges(roomElement: any): Promise<RoomBadge[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const badges: RoomBadge[] = [];
      
      const badgeElements = await roomElement.$$('.room-badges .badge');
      for (const badge of badgeElements) {
        const badgeText = await this.page.evaluate(el => el.textContent?.trim(), badge) || '';
        const iconElement = await badge.$('i');
        const iconClass = iconElement ? await this.page.evaluate(el => el.className, iconElement) : '';
        
        if (badgeText) {
          badges.push({
            icon: iconClass,
            text: badgeText
          });
        }
      }
      
      return badges;
      
    } catch (error: any) {
      console.error('❌ Failed to extract badges:', error.message);
      return [];
    }
  }

  /**
   * Extract images from room element
   */
  private async extractImages(roomElement: any): Promise<RoomImage[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const images: RoomImage[] = [];
      
      // Extract thumbnail images
      const thumbnailElements = await roomElement.$$('.card_slider-nav img');
      for (const thumbnail of thumbnailElements) {
        const src = await this.page.evaluate(el => el.getAttribute('src'), thumbnail) || '';
        if (src) {
          // Convert thumbnail URL to full size URL
          const fullSizeUrl = src.replace('-150.jpg', '-1024.jpg');
          images.push({
            thumbnail: src,
            fullSize: fullSizeUrl
          });
        }
      }
      
      return images;
      
    } catch (error: any) {
      console.error('❌ Failed to extract images:', error.message);
      return [];
    }
  }

  /**
   * Extract campaign tags from room element
   */
  private async extractCampaignTags(roomElement: any): Promise<string[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const campaignTags: string[] = [];
      
      const campaignElements = await roomElement.$$('.campaign-tag .badge span');
      for (const campaign of campaignElements) {
        const campaignText = await this.page.evaluate(el => el.textContent?.trim(), campaign) || '';
        if (campaignText) {
          campaignTags.push(campaignText);
        }
      }
      
      return campaignTags;
      
    } catch (error: any) {
      console.error('❌ Failed to extract campaign tags:', error.message);
      return [];
    }
  }

  /**
   * Extract cancellation policy from room element
   */
  private async extractCancellationPolicy(roomElement: any): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const cancelPolicyElement = await roomElement.$('.cancelPolicy-badge span');
      if (cancelPolicyElement) {
        return await this.page.evaluate(el => el.textContent?.trim(), cancelPolicyElement) || '';
      }
      return '';
      
    } catch (error: any) {
      console.error('❌ Failed to extract cancellation policy:', error.message);
      return '';
    }
  }

  /**
   * Extract child policy from room element
   */
  private async extractChildPolicy(roomElement: any): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const childPolicyElement = await roomElement.$('.two-free-kid');
      if (childPolicyElement) {
        return await this.page.evaluate(el => el.textContent?.trim(), childPolicyElement) || '';
      }
      return '';
      
    } catch (error: any) {
      console.error('❌ Failed to extract child policy:', error.message);
      return '';
    }
  }

  /**
   * Extract daily prices from room element
   */
  private async extractDailyPrices(roomElement: any): Promise<DailyPrice[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const dailyPrices: DailyPrice[] = [];
      
      // Extract daily prices directly from the night-count-box (no need to click)
      const priceElements = await roomElement.$$('.night-count-box .list');
      
      for (const priceElement of priceElements) {
        try {
          const dayElement = await priceElement.$('.top .day');
          const dateElement = await priceElement.$('.top .date');
          const oldPriceElement = await priceElement.$('.bottom .old-price');
          const currentPriceElement = await priceElement.$('.bottom .current-price');
          
          if (dayElement && dateElement && currentPriceElement) {
            const day = await this.page.evaluate(el => el.textContent?.trim(), dayElement) || '';
            const dateText = await this.page.evaluate(el => el.textContent?.trim(), dateElement) || '';
            const oldPrice = oldPriceElement ? await this.page.evaluate(el => el.textContent?.trim(), oldPriceElement) || '' : '';
            const currentPrice = await this.page.evaluate(el => el.textContent?.trim(), currentPriceElement) || '';
            
            // Parse date and day of week from the date text
            // Format: "31.07.2025 - Perşembe" or "31.07.2025 - <b>Perşembe</b>"
            let date = '';
            let dayOfWeek = '';
            
            if (dateText.includes(' - ')) {
              const parts = dateText.split(' - ');
              date = parts[0]?.trim() || '';
              dayOfWeek = parts[1]?.replace(/<\/?b>/g, '').trim() || '';
            }
            
            if (day && date && currentPrice) {
              dailyPrices.push({
                day,
                date,
                dayOfWeek,
                oldPrice,
                currentPrice
              });
            }
          }
        } catch (error) {
          // Continue with next price element if this one fails
          console.log(`⚠️ Failed to extract one daily price element: ${error}`);
        }
      }
      
      console.log(`📅 Extracted ${dailyPrices.length} daily prices`);
      
      return dailyPrices;
      
    } catch (error: any) {
      console.error('❌ Failed to extract daily prices:', error.message);
      return [];
    }
  }

  /**
   * Check if room is available
   */
  private async checkAvailability(roomElement: any): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Check if room has "request" or "off-sale" class
      const hasRequestClass = await this.page.evaluate(el => 
        el.classList.contains('request') || el.classList.contains('off-sale'), roomElement);
      
      return !hasRequestClass;
      
    } catch (error: any) {
      console.error('❌ Failed to check availability:', error.message);
      return true; // Assume available by default
    }
  }

  /**
   * Check if there are more rooms to load
   */
  private async checkForMoreRooms(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const loadMoreButton = await this.page.$('.other-product-card.other-button');
      if (!loadMoreButton) return false;
      
      const isVisible = await loadMoreButton.isVisible();
      if (!isVisible) return false;
      
      // Check if button is active and has rooms to load
      const buttonText = await this.page.evaluate(el => el.textContent?.trim(), loadMoreButton);
      const hasRooms = !!(buttonText && buttonText.includes('DİĞER ODALAR') && !buttonText.includes('(0)'));
      
      if (!hasRooms) return false;
      
      // Check if the arrow is pointing down (meaning there are more rooms to load)
      const arrowElement = await loadMoreButton.$('.icon-arrow-down');
      if (!arrowElement) {
        // If no down arrow, check if there's an up arrow (meaning all rooms are loaded)
        const upArrowElement = await loadMoreButton.$('.icon-arrow-up');
        if (upArrowElement) {
          console.log('🔄 All rooms already loaded (up arrow detected)');
          return false;
        }
      }
      
      // Additional check: if the button text shows (0) or similar, stop
      if (buttonText.includes('(0)') || buttonText.includes('0')) {
        console.log('🔄 No more rooms to load (0 count detected)');
        return false;
      }
      
      return true;
      
    } catch (error: any) {
      console.error('❌ Failed to check for more rooms:', error.message);
      return false;
    }
  }

  /**
   * Load more rooms if available
   */
  private async loadMoreRooms(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const loadMoreButton = await this.page.$('.other-product-card.other-button');
      if (!loadMoreButton) return;
      
      // Count rooms before clicking
      const roomsBefore = await this.page.$$('.product-info-box.simple.v2');
      const roomCountBefore = roomsBefore.length;
      
      console.log(`📄 Loading more rooms... (current: ${roomCountBefore})`);
      
      // Click the load more button
      await loadMoreButton.click();
      
      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Handle any popups that might appear after loading more content
      await this.handlePopups();
      
      // Wait a bit more for content to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Count rooms after clicking
      const roomsAfter = await this.page.$$('.product-info-box.simple.v2');
      const roomCountAfter = roomsAfter.length;
      
      if (roomCountAfter > roomCountBefore) {
        console.log(`✅ More rooms loaded (${roomCountBefore} → ${roomCountAfter})`);
      } else {
        console.log(`⚠️ No new rooms loaded (${roomCountBefore} → ${roomCountAfter})`);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load more rooms:', error.message);
    }
  }

  /**
   * Extract all room data from the page
   */
  private async extractAllRooms(): Promise<RoomData[]> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      const rooms: RoomData[] = [];
      
      // First, load all available rooms
      let hasMoreRooms = true;
      let loadAttempts = 0;
      const maxLoadAttempts = 5;
      let previousRoomCount = 0;
      
      while (hasMoreRooms && loadAttempts < maxLoadAttempts) {
        hasMoreRooms = await this.checkForMoreRooms();
        if (hasMoreRooms) {
          // Count rooms before loading more
          const currentRooms = await this.page.$$('.product-info-box.simple.v2');
          const currentRoomCount = currentRooms.length;
          
          await this.loadMoreRooms();
          loadAttempts++;
          
          // Check if room count increased
          const newRooms = await this.page.$$('.product-info-box.simple.v2');
          const newRoomCount = newRooms.length;
          
          if (newRoomCount <= currentRoomCount) {
            console.log(`🔄 No new rooms added (${currentRoomCount} → ${newRoomCount}), stopping load attempts`);
            break;
          }
          
          previousRoomCount = newRoomCount;
        }
      }
      
      // Debug: Check what elements are present on the page
      console.log('🔍 Debugging page content...');
      
      // Check for various possible selectors
      const possibleSelectors = [
        '.product-info-box.simple.v2',
        '.product-info-box',
        '.room-card',
        '.hotel-room',
        '.accommodation-item',
        '.room-item',
        '.product-card',
        '.booking-item',
        '.product-tab-content',
        '.room-list',
        '.accommodation-list',
        '.hotel-rooms',
        '.booking-options',
        '.room-options',
        '.product-list',
        '.item-list',
        '.content-list',
        '.main-content',
        '.hotel-content',
        '.room-content'
      ];
      
      for (const selector of possibleSelectors) {
        const elements = await this.page.$$(selector);
        console.log(`🔍 Selector "${selector}": ${elements.length} elements found`);
      }
      
      // Get page HTML structure for debugging
      const pageContent = await this.page.content();
      console.log('🔍 Page title:', await this.page.title());
      console.log('🔍 Current URL:', this.page.url());
      
      // Check if we're on the right page
      if (pageContent.includes('Nirvana Mediterranean Excellence')) {
        console.log('✅ Hotel name found in page content');
      } else {
        console.log('❌ Hotel name not found in page content');
      }
      
      // Look for any elements with "room" or "oda" in their class names
      const allElements = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const roomElements = [];
        for (const el of elements) {
          const className = el.className || '';
          if (typeof className === 'string' && (className.includes('room') || className.includes('oda') || className.includes('product'))) {
            roomElements.push({
              tagName: el.tagName,
              className: className,
              id: el.id || '',
              textContent: el.textContent?.substring(0, 100) || ''
            });
          }
        }
        return roomElements.slice(0, 20); // Return first 20 matches
      });
      
      console.log('🔍 Elements with room/oda/product in class names:', allElements);
      
      // Extract all room elements
      const roomElements = await this.page.$$('.product-info-box.simple.v2');
      console.log(`🏨 Found ${roomElements.length} room elements`);
      
      for (let i = 0; i < roomElements.length; i++) {
        console.log(`📋 Extracting room ${i + 1}/${roomElements.length}...`);
        
        const roomData = await this.extractRoomData(roomElements[i]);
        if (roomData) {
          rooms.push(roomData);
          console.log(`✅ Room "${roomData.roomName}" extracted successfully`);
        } else {
          console.log(`❌ Failed to extract room ${i + 1}`);
        }
      }
      
      console.log(`🎉 Successfully extracted ${rooms.length} rooms`);
      return rooms;
      
    } catch (error: any) {
      console.error('❌ Failed to extract all rooms:', error.message);
      return [];
    }
  }

  /**
   * Main method to scrape hotel details
   */
  async scrapeHotelDetails(hotelSlug: string, searchParams: SearchParams): Promise<ScrapedData | null> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      console.log(`🏨 Starting to scrape hotel: ${hotelSlug}`);
      
      // Build URL and navigate
      const url = this.buildJollyTurUrl(hotelSlug, searchParams);
      await this.navigateToHotelPage(url);
      
      // Extract hotel name
      const hotelName = await this.extractHotelName();
      
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'jollytur-debug.png', fullPage: true });
      console.log('📸 Screenshot saved as jollytur-debug.png');
      
      // Extract all rooms
      const rooms = await this.extractAllRooms();
      
      if (rooms.length === 0) {
        console.log('❌ No rooms found');
        return null;
      }
      
      const scrapedData: ScrapedData = {
        hotelName,
        hotelSlug,
        searchParams,
        rooms,
        scrapedAt: new Date().toISOString(),
        totalRooms: rooms.length
      };
      
      console.log(`✅ Successfully scraped ${rooms.length} rooms for ${hotelName}`);
      return scrapedData;
      
    } catch (error: any) {
      console.error('❌ Failed to scrape hotel details:', error.message);
      return null;
    }
  }

  /**
   * Save scraped data to file
   */
  async saveScrapedData(scrapedData: ScrapedData): Promise<string> {
    try {
      // Create jollytur directory if it doesn't exist
      const jollyturDir = path.join(process.cwd(), 'src', 'scrapedData', 'jollytur');
      await fs.mkdir(jollyturDir, { recursive: true });
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create filename
      const hotelNameSlug = scrapedData.hotelSlug.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = `${timestamp}_${hotelNameSlug}.json`;
      const filepath = path.join(jollyturDir, filename);
      
      // Prepare data to save
      const dataToSave = {
        ...scrapedData,
        scraper: 'JollyTurScraper'
      };
      
      // Save to file
      await fs.writeFile(filepath, JSON.stringify(dataToSave, null, 2), 'utf8');
      
      console.log(`✅ Scraped data saved to: ${filepath}`);
      return filepath;
      
    } catch (error: any) {
      console.error('❌ Failed to save scraped data:', error.message);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log('🔒 Closing JollyTur scraper...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ JollyTur scraper closed');
    }
  }
} 