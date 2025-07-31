// src/services/scraping/EtsturScraper.ts

import puppeteer, { Browser, Page } from 'puppeteer';
import { executablePath } from 'puppeteer'; // Puppeteer Chromium yürütülebilir yolunu almak için
import { setTimeout } from 'timers/promises'; // Asenkron gecikmeler için
import * as fs from 'fs/promises';
import * as path from 'path';

// NOT: Bu versiyon, henüz tanımlanmamış olan 'logger' veya '@models/ScrapingModels' bağımlılıklarını kullanmaz.
// Kazınan veriler doğrudan 'any' tipi olarak döndürülür.

/**
 * EtsturScraper: Etstur web sitesinden otel ve fiyat verilerini kazıma işlemlerini yönetir.
 * Sayfalarda gezinir, elementlerle etkileşime girer ve ilgili verileri çıkarır.
 * Bu versiyon, doğrudan otel detay sayfalarını hedefleyerek çalışır ve ham JSON verisi döndürür.
 */
export class EtsturScraper {
  private browser: Browser | null = null;
  private readonly baseUrl = 'https://www.etstur.com'; // Etstur temel URL'i

  constructor() {
    try {
      executablePath(); // Puppeteer Chromium yürütülebilir dosyasının varlığını kontrol et
      // console.log('Puppeteer Chromium yürütülebilir dosyası bulundu.'); // Logger yerine geçici console.log
    } catch (e) {
      console.error('Puppeteer Chromium bulunamadı. Lütfen `npm install puppeteer` veya `yarn add puppeteer` komutunu çalıştırın.');
    }
  }

  /**
   * Puppeteer tarayıcı örneğini başlatır.
   * @param headless Tarayıcının başsız modda (UI olmadan) çalışıp çalışmayacağı. Varsayılan true.
   */
  async initialize(headless: boolean = true): Promise<void> {
    // console.log(`Puppeteer tarayıcısı ${headless ? 'başsız' : 'görsel'} modda başlatılıyor...`); // Logger yerine geçici console.log
    try {
      this.browser = await puppeteer.launch({
        headless: headless, // Use boolean directly for compatibility
        executablePath: executablePath(), // Chromium yürütülebilir yolunu kullan
        args: [
          '--no-sandbox', // Docker ortamları için gerekli
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Docker ortamları için önerilir (paylaşılan bellek kullanımı)
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080', // Tarayıcı pencere boyutu
        ],
      });
      // console.log('Puppeteer tarayıcısı başlatıldı.'); // Logger yerine geçici console.log
    } catch (error: any) {
      console.error(`Puppeteer tarayıcısı başlatılamadı: ${error.message}`);
      throw new Error('Puppeteer tarayıcısı başlatılamadı.');
    }
  }

  /**
   * Kazınan veriyi etstur dizinine kaydeder.
   */
  async saveScrapedData(data: any, hotelUrl: string, searchParams: any): Promise<string> {
    try {
      // Create etstur directory if it doesn't exist
      const etsturDir = path.join(process.cwd(), 'src', 'scrapedData', 'etstur');
      await fs.mkdir(etsturDir, { recursive: true });
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create filename from hotel URL
      const hotelNameSlug = hotelUrl.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'unknown_hotel';
      const filename = `${timestamp}_${hotelNameSlug}.json`;
      const filepath = path.join(etsturDir, filename);
      
      // Prepare data to save
      const dataToSave = {
        ...data,
        scrapedAt: new Date().toISOString(),
        hotelUrl: hotelUrl,
        searchParams: searchParams,
        scraper: 'EtsturScraper'
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

  /**
   * Puppeteer tarayıcı örneğini kapatır.
   */
  async close(): Promise<void> {
    if (this.browser) {
      // console.log('Puppeteer tarayıcısı kapatılıyor...'); // Logger yerine geçici console.log
      await this.browser.close();
      this.browser = null;
      // console.log('Puppeteer tarayıcısı kapatıldı.'); // Logger yerine geçici console.log
    }
  }

  /**
   * Belirtilen URL'e gider ve sayfanın yüklenmesini bekler.
   * @param page Puppeteer Page nesnesi.
   * @param url Gidilecek URL.
   */
  private async navigate(page: Page, url: string): Promise<void> {
    // console.log(`Şu adrese gidiliyor: ${url}`); // Logger yerine geçici console.log
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 });
      // console.log(`Başarıyla gidildi: ${url}`); // Logger yerine geçici console.log
    } catch (error: any) {
      console.error(`"${url}" adresine gitme başarısız oldu: ${error.message}`);
      throw new Error(`"${url}" adresine gitme başarısız oldu.`);
    }
  }

  /**
   * Etstur.com'daki çerez rıza pop-up'ını kapatmaya çalışır.
   * @param page Puppeteer Page nesnesi.
   */
  private async handleCookieConsent(page: Page): Promise<void> {
    const cookieConsentSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
    try {
      await page.waitForSelector(cookieConsentSelector, { timeout: 5000 });
      // console.log('Çerez rıza pop-up\'ı tespit edildi. Kabul et butonuna tıklanıyor.'); // Logger yerine geçici console.log
      await page.click(cookieConsentSelector);
      await setTimeout(1000); // UI'ın güncellenmesi için kısa bir gecikme
    } catch (e) {
      // console.log('Çerez rıza pop-up\'ı bulunamadı veya zaten kapatılmış.'); // Logger yerine geçici console.log
    }
  }

  /**
   * Kazınan veriyi room.json formatında doğrular ve işler.
   * @param scrapedData Kazınan ham veri
   * @returns Doğrulanmış ve işlenmiş room.json formatında veri
   */
  private validateAndProcessRoomData(scrapedData: any): any {
    if (!scrapedData || !scrapedData.result) {
      return null;
    }

    const result = scrapedData.result;
    
    // Temel yapıyı doğrula
    const validatedData = {
      success: scrapedData.success || true,
      errorCode: scrapedData.errorCode || null,
      errorMessage: scrapedData.errorMessage || null,
      result: {
        roomSearchId: result.roomSearchId || null,
        earlyBookingInsuranceAvailable: result.earlyBookingInsuranceAvailable || false,
        rooms: Array.isArray(result.rooms) ? result.rooms : [],
        minPrice: result.minPrice || null,
        includeTaxes: result.includeTaxes || false,
        flightPackage: result.flightPackage || false,
        noDates: result.noDates || false,
        promotions: Array.isArray(result.promotions) ? result.promotions : [],
        checkIn: result.checkIn || null,
        checkOut: result.checkOut || null
      }
    };

    // Oda verilerini doğrula ve temizle
    validatedData.result.rooms = validatedData.result.rooms.map((room: any) => ({
      roomId: room.roomId || null,
      roomName: room.roomName || '',
      description: room.description || null,
      roomSize: room.roomSize || null,
      roomCapacity: room.roomCapacity || null,
      maxChildCapacity: room.maxChildCapacity || null,
      maxAdultCapacity: room.maxAdultCapacity || null,
      bedTypes: Array.isArray(room.bedTypes) ? room.bedTypes : [],
      images: Array.isArray(room.images) ? room.images : [],
      facilities: Array.isArray(room.facilities) ? room.facilities : [],
      badges: Array.isArray(room.badges) ? room.badges : [],
      nightCount: room.nightCount || 0,
      nightlyMinPrice: room.nightlyMinPrice || null,
      subBoards: Array.isArray(room.subBoards) ? room.subBoards : [],
      acceptChild: room.acceptChild || false,
      secretRoom: room.secretRoom || false
    }));

    return validatedData;
  }

  /**
   * Müsait odaları filtreler ve döndürür.
   * @param roomData room.json formatında oda verisi
   * @returns Müsait odaların listesi
   */
  getAvailableRooms(roomData: any): any[] {
    if (!roomData?.result?.rooms) {
      return [];
    }

    return roomData.result.rooms.filter((room: any) => {
      // Müsait subBoards'ları kontrol et
      return room.subBoards && room.subBoards.some((board: any) => 
        board.availability?.type === 'AVAILABLE'
      );
    });
  }

  /**
   * En düşük fiyatlı odayı bulur.
   * @param roomData room.json formatında oda verisi
   * @returns En düşük fiyatlı oda bilgisi
   */
  getLowestPriceRoom(roomData: any): any | null {
    const availableRooms = this.getAvailableRooms(roomData);
    
    if (availableRooms.length === 0) {
      return null;
    }

    return availableRooms.reduce((lowest: any, room: any) => {
      const roomMinPrice = room.nightlyMinPrice?.amount || Infinity;
      const lowestPrice = lowest.nightlyMinPrice?.amount || Infinity;
      
      return roomMinPrice < lowestPrice ? room : lowest;
    });
  }

  /**
   * Oda fiyat özetini döndürür.
   * @param roomData room.json formatında oda verisi
   * @returns Fiyat özeti
   */
  getPriceSummary(roomData: any): any {
    const availableRooms = this.getAvailableRooms(roomData);
    
    if (availableRooms.length === 0) {
      return {
        totalRooms: 0,
        availableRooms: 0,
        priceRange: null,
        averagePrice: null
      };
    }

    const prices = availableRooms
      .map((room: any) => room.nightlyMinPrice?.amount)
      .filter((price: number) => price && price > 0);

    return {
      totalRooms: roomData.result.rooms.length,
      availableRooms: availableRooms.length,
      priceRange: prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices)
      } : null,
      averagePrice: prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null
    };
  }

  /**
   * Belirli bir otelin detaylı bilgilerini (oda tipleri ve günlük fiyatlar dahil) kazır.
   * Bu metod, network isteklerini dinleyerek room.json verisini doğrudan API'den alır.
   * @param hotelRelativeUrl Otelin Etstur.com üzerindeki göreli URL'i (örneğin, '/Alba-Resort-Hotel').
   * @param params Kazıma parametreleri (tarihler ve misafir sayısı).
   * @returns Kazınan otel detaylarını içeren room.json formatında JSON nesnesi veya null.
   */
  async scrapeHotelDetails(
    hotelRelativeUrl: string,
    params: {
      checkInDate: string;
      checkOutDate: string;
      adults: number;
      children: number;
      childAges?: number[];
    }
  ): Promise<any | null> {
    if (!this.browser) {
      throw new Error('Tarayıcı başlatılmadı. Önce initialize() metodunu çağırın.');
    }
    const page = await this.browser.newPage();
    let hotelDetails: any | null = null;

    try {
      // Network isteklerini dinlemeye başla
      const responses: any[] = [];
      
      page.on('response', async (response) => {
        const url = response.url();
        // Room API isteklerini yakala
        if (url.includes('/api/') && (url.includes('room') || url.includes('hotel') || url.includes('detail'))) {
          try {
            const responseData = await response.json();
            responses.push({
              url: url,
              data: responseData,
              status: response.status()
            });
            console.log(`API Response captured: ${url}`);
          } catch (e) {
            // JSON parse edilemezse atla
          }
        }
      });

      // Otel detay sayfası için tam URL'i parametrelerle birlikte oluştur
      const fullUrl = `${this.baseUrl}${hotelRelativeUrl}?${new URLSearchParams({
        check_in: params.checkInDate.split('-').reverse().join('.'), // GG.AA.YYYY formatına çevir
        check_out: params.checkOutDate.split('-').reverse().join('.'), // GG.AA.YYYY formatına çevir
        adult_1: String(params.adults),
        ...(params.children > 0 && { child_1: String(params.children) }), // Çocuk varsa ekle
        ...(params.children > 0 && params.childAges && Object.fromEntries(params.childAges.map((age, i) => [`childage_1_${i + 1}`, String(age)]))),
      }).toString()}`;

      console.log(`Navigating to: ${fullUrl}`);
      await this.navigate(page, fullUrl);
      await this.handleCookieConsent(page);

      // Sayfanın tamamen yüklenmesini bekle
      await setTimeout(5000);

      // Network isteklerini bekle
      await setTimeout(3000);

      // Room.json formatında veri ara
      for (const response of responses) {
        if (response.data && response.data.result && Array.isArray(response.data.result.rooms)) {
          console.log(`Found room data in API response: ${response.url}`);
          hotelDetails = response.data;
          break;
        }
      }

      // Eğer network isteklerinde bulunamazsa, alternatif yöntem dene
      if (!hotelDetails) {
        console.log('Room data not found in network requests, trying alternative method...');
        
        // Sayfayı yenile ve daha uzun bekle
        await page.reload({ waitUntil: 'networkidle0' });
        await setTimeout(3000);
        
        // Tekrar network isteklerini kontrol et
        for (const response of responses) {
          if (response.data && response.data.result && Array.isArray(response.data.result.rooms)) {
            console.log(`Found room data in API response after reload: ${response.url}`);
            hotelDetails = response.data;
            break;
          }
        }
      }

      if (!hotelDetails) {
        console.error(`Room data not found for ${hotelRelativeUrl}`);
        return null;
      }

      console.log(`Successfully extracted room data with ${hotelDetails.result?.rooms?.length || 0} rooms`);

    } catch (error: any) {
      console.error(`"${hotelRelativeUrl}" otel detaylarını kazıma hatası: ${error.message}`);
      throw new Error(`"${hotelRelativeUrl}" otel detaylarını kazıma başarısız oldu.`);
    } finally {
      await page.close();
    }
    return hotelDetails;
  }
}