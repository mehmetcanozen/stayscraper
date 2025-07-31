// src/services/HotelPriceService.ts

import { EtsturScraper } from './scraping/EtsTurScraper';
import { ObiletScraper } from './scraping/ObiletScraper';
import { HotelsComScraper } from './scraping/HotelsComScraper';
import { SeturScraper } from './scraping/SeturScraper';
import { JollyTurScraper } from './scraping/JollyTurScraper';
import { TouristicaScraper } from './scraping/TouristicaScraper';
import * as fs from 'fs/promises'; // Dosya işlemleri için fs/promises kullanıyoruz
import * as path from 'path'; // Dosya yollarını yönetmek için

// NOT: Bu versiyon, henüz tanımlanmamış olan 'logger' veya '@models/ScrapingModels' bağımlılıklarını kullanmaz.
// Kazınan veriler doğrudan 'any' tipi olarak işlenir ve console.log kullanılır.

/**
 * HotelPriceService: Kazıma sürecini yönetir ve kazınan verileri dosyaya kaydeder.
 * Veritabanı entegrasyonu olmadan doğrudan dosya yazma odaklıdır.
 */
export class HotelPriceService {
  private etsturScraper: EtsturScraper;
  private obiletScraper: ObiletScraper;
  private hotelsComScraper: HotelsComScraper;
  private seturScraper: SeturScraper;
  private jollyturScraper: JollyTurScraper;
  private touristicaScraper: TouristicaScraper;
  private readonly scrapedDataDir: string;

  constructor() {
    this.etsturScraper = new EtsturScraper();
    this.obiletScraper = new ObiletScraper();
    this.hotelsComScraper = new HotelsComScraper();
    this.seturScraper = new SeturScraper();
    this.jollyturScraper = new JollyTurScraper();
    this.touristicaScraper = new TouristicaScraper();
    // ScrapedData dizinini ayarla
    this.scrapedDataDir = path.join(process.cwd(), 'src', 'scrapedData', 'etstur');
    console.log(`Kazınan veriler şu dizine kaydedilecek: ${this.scrapedDataDir}`);
  }

  /**
   * ScrapedData dizinini oluşturur (yoksa)
   */
  private async ensureScrapedDataDir(): Promise<void> {
    try {
      await fs.access(this.scrapedDataDir);
    } catch {
      await fs.mkdir(this.scrapedDataDir, { recursive: true });
      console.log(`ScrapedData dizini oluşturuldu: ${this.scrapedDataDir}`);
    }
  }

  /**
   * Otel verilerini dosyaya kaydeder
   * @param hotelData Otel verisi
   * @param hotelUrl Otel URL'i (dosya adı için)
   * @param timestamp Zaman damgası
   */
  private async saveHotelData(hotelData: any, hotelUrl: string, timestamp: string): Promise<void> {
    const hotelName = hotelUrl.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    const fileName = `${timestamp}_${hotelName}.json`;
    const filePath = path.join(this.scrapedDataDir, fileName);
    
    const dataToSave = JSON.stringify(hotelData, null, 2);
    await fs.writeFile(filePath, dataToSave, 'utf8');
    console.log(`Otel verisi kaydedildi: ${filePath}`);
  }

  /**
   * Tüm kazıma oturumunu özet dosyasına kaydeder
   * @param allHotelData Tüm otel verileri
   * @param params Kazıma parametreleri
   * @param timestamp Zaman damgası
   */
  private async saveSessionSummary(allHotelData: any[], params: any, timestamp: string): Promise<void> {
    const summaryFileName = `${timestamp}_scraping_session_summary.json`;
    const summaryFilePath = path.join(this.scrapedDataDir, summaryFileName);
    
    const sessionSummary = {
      timestamp: timestamp,
      scrapeParameters: params,
      totalHotels: allHotelData.length,
      successfulScrapes: allHotelData.filter(data => data && data.success).length,
      failedScrapes: allHotelData.filter(data => !data || !data.success).length,
      hotels: allHotelData.map((data, index) => ({
        index: index,
        success: data && data.success,
        hotelUrl: params.hotelRelativeUrls[index],
        roomCount: data?.result?.rooms?.length || 0,
        hasData: !!data
      }))
    };
    
    const summaryData = JSON.stringify(sessionSummary, null, 2);
    await fs.writeFile(summaryFilePath, summaryData, 'utf8');
    console.log(`Kazıma oturumu özeti kaydedildi: ${summaryFilePath}`);
  }

  /**
   * Etstur.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * Bu metod, kullanıcının belirli otel göreli URL'lerini alarak çalışır.
   * @param params Kazıma parametreleri (otel URL'leri, tarihler, misafir sayısı).
   */
  async scrapeAndSaveToFile(params: {
    hotelRelativeUrls: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    childAges?: number[];
  }): Promise<void> {
    console.log(`Etstur için kazıma başlatılıyor, parametreler: ${JSON.stringify(params)}`);

    // ScrapedData dizinini oluştur
    await this.ensureScrapedDataDir();

    // Zaman damgası oluştur
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];

    // Scraper tarayıcısını bir kez başlat
    await this.etsturScraper.initialize(true); // true = headless mod

    const allScrapedHotelData: any[] = []; // Kazınan tüm otel verilerini tutacak dizi

    try {
      // Her bir otel URL'i için döngü
      for (const hotelRelativeUrl of params.hotelRelativeUrls) {
        console.log(`"${hotelRelativeUrl}" oteli için detaylı kazıma başlatılıyor...`);
        try {
          // EtsturScraper'dan ham otel detaylarını al
          const hotelDetails: any | null = await this.etsturScraper.scrapeHotelDetails(
            hotelRelativeUrl,
            params
          );

          if (hotelDetails && hotelDetails.result && Array.isArray(hotelDetails.result.rooms)) {
            // Network interception'dan gelen raw room.json verisini kullan
            allScrapedHotelData.push({
              success: true,
              errorCode: null,
              errorMessage: null,
              result: hotelDetails.result
            });
            
            // Her otel verisini ayrı dosyaya kaydet
            await this.saveHotelData(hotelDetails, hotelRelativeUrl, timestamp);
            
            console.log(`"${hotelDetails.result.rooms.length} oda tipi ile otel verileri başarıyla kazındı.`);
          } else {
            allScrapedHotelData.push(null);
            console.warn(`"${hotelRelativeUrl}" oteli için veri kazılamadı veya müsait değil.`);
            if (hotelDetails) {
              console.error(`Veri yapısı geçersiz: ${JSON.stringify(hotelDetails).substring(0, 200)}...`);
            }
          }
        } catch (hotelScrapeError: any) {
          allScrapedHotelData.push(null);
          console.error(`"${hotelRelativeUrl}" otelini kazıma sırasında hata oluştu: ${hotelScrapeError.message}`);
          // Bir otel başarısız olsa bile diğerlerine devam et
        }
      }

      // Kazıma oturumu özetini kaydet
      if (allScrapedHotelData.length > 0) {
        await this.saveSessionSummary(allScrapedHotelData, params, timestamp);
        
        const successfulScrapes = allScrapedHotelData.filter(data => data && data.success).length;
        console.log(`Kazıma oturumu tamamlandı. ${successfulScrapes}/${allScrapedHotelData.length} otel başarıyla kazındı.`);
        console.log(`Tüm veriler "${this.scrapedDataDir}" dizinine kaydedildi.`);
      } else {
        console.log('Kazınacak otel verisi bulunamadı.');
      }

    } catch (mainError: any) {
      console.error(`Genel kazıma işlemi sırasında hata oluştu: ${mainError.message}`);
      throw mainError; // Hatayı yukarıya fırlat
    } finally {
      await this.etsturScraper.close(); // Tarayıcıyı her zaman kapat
    }
  }

  /**
   * Obilet.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * Bu metod, otel adlarını alarak çalışır ve gerekirse hotel ID'lerini keşfeder.
   * @param params Kazıma parametreleri (otel adları, tarihler, misafir sayısı).
   */
  async scrapeObiletAndSaveToFile(params: {
    hotelNames: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    childAges?: number[];
  }): Promise<void> {
    console.log(`Obilet için kazıma başlatılıyor, parametreler: ${JSON.stringify(params)}`);

    try {
      // Obilet scraper'ı başlat
      await this.obiletScraper.initialize();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const allScrapedHotelData: any[] = [];

      // Her otel için kazıma yap
      for (const hotelName of params.hotelNames) {
        try {
          console.log(`Obilet'ten kazınıyor: ${hotelName}`);

          const searchParams = {
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            adults: params.adults,
            children: params.children || 0,
            childAges: params.childAges || []
          };

          // Otel verilerini kazı
          const scrapedData = await this.obiletScraper.scrapeHotelDetails(hotelName, searchParams);

          if (scrapedData && scrapedData.rooms.length > 0) {
            // Veriyi dosyaya kaydet
            const filePath = await this.obiletScraper.saveScrapedData(scrapedData);
            
            allScrapedHotelData.push({
              success: true,
              hotelName: hotelName,
              hotelId: scrapedData.hotelId,
              roomCount: scrapedData.rooms.length,
              filePath: filePath,
              result: scrapedData
            });

            console.log(`✅ ${hotelName} başarıyla kazındı (${scrapedData.rooms.length} oda)`);
          } else {
            allScrapedHotelData.push({
              success: false,
              hotelName: hotelName,
              error: 'No room data found'
            });
            console.log(`❌ ${hotelName} kazınamadı: Oda verisi bulunamadı`);
          }

        } catch (hotelError: any) {
          console.error(`❌ ${hotelName} kazınırken hata: ${hotelError.message}`);
          allScrapedHotelData.push({
            success: false,
            hotelName: hotelName,
            error: hotelError.message
          });
        }
      }

      // Kazıma oturumu özetini kaydet
      if (allScrapedHotelData.length > 0) {
        const successfulScrapes = allScrapedHotelData.filter(data => data && data.success).length;
        console.log(`Obilet kazıma oturumu tamamlandı. ${successfulScrapes}/${allScrapedHotelData.length} otel başarıyla kazındı.`);
        console.log(`Tüm veriler "src/scrapedData/obilet" dizinine kaydedildi.`);
      } else {
        console.log('Kazınacak otel verisi bulunamadı.');
      }

    } catch (mainError: any) {
      console.error(`Genel Obilet kazıma işlemi sırasında hata oluştu: ${mainError.message}`);
      throw mainError;
    } finally {
      await this.obiletScraper.close(); // Tarayıcıyı her zaman kapat
    }
  }

  /**
   * Hotels.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * Bu metod, otel adlarını alarak çalışır ve gerekirse hotel ID'lerini keşfeder.
   * @param params Kazıma parametreleri (otel adları, tarihler, misafir sayısı).
   */
  async scrapeHotelsComAndSaveToFile(params: {
    hotelNames: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    childAges?: number[];
  }): Promise<void> {
    console.log(`Hotels.com için kazıma başlatılıyor, parametreler: ${JSON.stringify(params)}`);

    try {
      // Hotels.com scraper'ı başlat
      await this.hotelsComScraper.initialize();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const allScrapedHotelData: any[] = [];

      // Her otel için kazıma yap
      for (const hotelName of params.hotelNames) {
        try {
          console.log(`Hotels.com'dan kazınıyor: ${hotelName}`);

          const searchParams = {
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            adults: params.adults,
            children: params.children || 0,
            childAges: params.childAges || []
          };

          // Otel verilerini kazı
          const scrapedData = await this.hotelsComScraper.scrapeHotelDetails(hotelName, searchParams);

          if (scrapedData && scrapedData.rooms.length > 0) {
            // Veriyi dosyaya kaydet
            const filePath = await this.hotelsComScraper.saveScrapedData(scrapedData);
            
            allScrapedHotelData.push({
              success: true,
              hotelName: hotelName,
              hotelId: scrapedData.hotelId,
              roomCount: scrapedData.rooms.length,
              filePath: filePath,
              result: scrapedData
            });

            console.log(`✅ ${hotelName} başarıyla kazındı (${scrapedData.rooms.length} oda)`);
          } else {
            allScrapedHotelData.push({
              success: false,
              hotelName: hotelName,
              error: 'No room data found'
            });
            console.log(`❌ ${hotelName} kazınamadı: Oda verisi bulunamadı`);
          }

        } catch (hotelError: any) {
          console.error(`❌ ${hotelName} kazınırken hata: ${hotelError.message}`);
          allScrapedHotelData.push({
            success: false,
            hotelName: hotelName,
            error: hotelError.message
          });
        }
      }

      // Kazıma oturumu özetini kaydet
      if (allScrapedHotelData.length > 0) {
        const successfulScrapes = allScrapedHotelData.filter(data => data && data.success).length;
        console.log(`Hotels.com kazıma oturumu tamamlandı. ${successfulScrapes}/${allScrapedHotelData.length} otel başarıyla kazındı.`);
        console.log(`Tüm veriler "src/scrapedData/hotelscom" dizinine kaydedildi.`);
      } else {
        console.log('Kazınacak otel verisi bulunamadı.');
      }

    } catch (mainError: any) {
      console.error(`Genel Hotels.com kazıma işlemi sırasında hata oluştu: ${mainError.message}`);
      throw mainError;
    } finally {
      await this.hotelsComScraper.close(); // Tarayıcıyı her zaman kapat
    }
  }

  /**
   * ScrapedData dizinindeki tüm dosyaları listeler
   * @returns Dosya listesi
   */
  async listScrapedFiles(): Promise<string[]> {
    await this.ensureScrapedDataDir();
    
    try {
      const files = await fs.readdir(this.scrapedDataDir);
      return files.filter(file => file.endsWith('.json')).sort().reverse(); // En yeni dosyalar önce
    } catch (error) {
      console.error('Dosya listesi alınırken hata:', error);
      return [];
    }
  }

  /**
   * Belirli bir dosyayı okur
   * @param fileName Dosya adı
   * @returns Dosya içeriği
   */
  async readScrapedFile(fileName: string): Promise<any | null> {
    try {
      const filePath = path.join(this.scrapedDataDir, fileName);
      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Dosya okuma hatası (${fileName}):`, error);
      return null;
    }
  }

  /**
   * En son kazıma oturumunu getirir
   * @returns En son oturum verisi
   */
  async getLatestSession(): Promise<any | null> {
    const files = await this.listScrapedFiles();
    const summaryFiles = files.filter(file => file.includes('scraping_session_summary'));
    
    if (summaryFiles.length === 0) {
      return null;
    }
    
    return await this.readScrapedFile(summaryFiles[0]);
  }

  /**
   * Belirli bir tarihteki kazıma oturumlarını getirir
   * @param date Tarih (YYYY-MM-DD formatında)
   * @returns O tarihteki oturumlar
   */
  async getSessionsByDate(date: string): Promise<any[]> {
    const files = await this.listScrapedFiles();
    const dateFiles = files.filter(file => file.startsWith(date));
    
    const sessions: any[] = [];
    for (const file of dateFiles) {
      const data = await this.readScrapedFile(file);
      if (data) {
        sessions.push({
          fileName: file,
          data: data
        });
      }
    }
    
    return sessions;
  }

  /**
   * Setur.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * @param params Kazıma parametreleri
   */
  async scrapeSeturAndSaveToFile(params: {
    hotelSlugs: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    childBirthdates?: string[];
    headless?: boolean;
  }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Setur kazıma oturumu başlatılıyor: ${timestamp}`);
    
    try {
      // Setur scraper'ı başlat
      await this.seturScraper.initialize(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        params.headless ?? true
      );
      
      const allHotelData: any[] = [];
      
      // Her otel için kazıma yap
      for (const hotelSlug of params.hotelSlugs) {
        try {
          console.log(`Setur'dan kazınıyor: ${hotelSlug}`);
          
          const scrapeParams = {
            hotelSlug,
            checkIn: params.checkInDate,
            checkOut: params.checkOutDate,
            adults: params.adults,
            childBirthdates: params.childBirthdates || [],
            headless: params.headless ?? true
          };
          
          const rooms = await this.seturScraper.scrapeHotelRooms(scrapeParams);
          
          const hotelData = {
            success: true,
            hotelSlug,
            timestamp,
            scrapeParameters: scrapeParams,
            result: {
              rooms,
              totalRooms: rooms.length
            }
          };
          
          allHotelData.push(hotelData);
          
          // Her otel için ayrı dosya kaydet
          await this.seturScraper.saveScrapedData(
            hotelSlug,
            params.checkInDate,
            params.checkOutDate,
            rooms
          );
          
          console.log(`✅ ${hotelSlug}: ${rooms.length} oda bulundu`);
          
        } catch (error) {
          console.error(`❌ ${hotelSlug} kazıma hatası:`, error);
          allHotelData.push({
            success: false,
            hotelSlug,
            timestamp,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Oturum özeti kaydet
      const sessionSummary = {
        timestamp,
        scrapeParameters: params,
        totalHotels: params.hotelSlugs.length,
        successfulScrapes: allHotelData.filter(data => data.success).length,
        failedScrapes: allHotelData.filter(data => !data.success).length,
        hotels: allHotelData.map(data => ({
          hotelSlug: data.hotelSlug,
          success: data.success,
          roomCount: data.result?.rooms?.length || 0
        }))
      };
      
      // Setur dizinine özet kaydet
      const seturDir = path.join(process.cwd(), 'src', 'scrapedData', 'setur');
      await fs.mkdir(seturDir, { recursive: true });
      const summaryPath = path.join(seturDir, `${timestamp}_setur_scraping_session_summary.json`);
      await fs.writeFile(summaryPath, JSON.stringify(sessionSummary, null, 2));
      
      console.log(`✅ Setur kazıma oturumu tamamlandı. ${sessionSummary.successfulScrapes}/${sessionSummary.totalHotels} başarılı.`);
      
    } catch (error) {
      console.error('Setur kazıma oturumu hatası:', error);
      throw error;
    } finally {
      // Browser'ı kapat
      await this.seturScraper.close();
    }
  }

  /**
   * JollyTur.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * @param params Kazıma parametreleri
   */
  async scrapeJollyTurAndSaveToFile(params: {
    hotelSlugs: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    childAges?: number[];
    headless?: boolean;
  }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`JollyTur kazıma oturumu başlatılıyor: ${timestamp}`);
    
    try {
      // JollyTur scraper'ı başlat
      await this.jollyturScraper.initialize(params.headless ?? true);
      
      const allHotelData: any[] = [];
      
      // Her otel için kazıma yap
      for (const hotelSlug of params.hotelSlugs) {
        try {
          console.log(`JollyTur'dan kazınıyor: ${hotelSlug}`);
          
          const searchParams = {
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            adults: params.adults,
            children: params.children || 0,
            childAges: params.childAges || []
          };
          
          const scrapedData = await this.jollyturScraper.scrapeHotelDetails(hotelSlug, searchParams);
          
          if (scrapedData && scrapedData.rooms.length > 0) {
            // Veriyi dosyaya kaydet
            const filePath = await this.jollyturScraper.saveScrapedData(scrapedData);
            
            allHotelData.push({
              success: true,
              hotelSlug,
              hotelName: scrapedData.hotelName,
              roomCount: scrapedData.rooms.length,
              filePath: filePath,
              result: scrapedData
            });
            
            console.log(`✅ ${hotelSlug}: ${scrapedData.rooms.length} oda bulundu`);
          } else {
            allHotelData.push({
              success: false,
              hotelSlug,
              error: 'No room data found'
            });
            console.log(`❌ ${hotelSlug} kazınamadı: Oda verisi bulunamadı`);
          }
          
        } catch (error) {
          console.error(`❌ ${hotelSlug} kazıma hatası:`, error);
          allHotelData.push({
            success: false,
            hotelSlug,
            timestamp,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Oturum özeti kaydet
      const sessionSummary = {
        timestamp,
        scrapeParameters: params,
        totalHotels: params.hotelSlugs.length,
        successfulScrapes: allHotelData.filter(data => data.success).length,
        failedScrapes: allHotelData.filter(data => !data.success).length,
        hotels: allHotelData.map(data => ({
          hotelSlug: data.hotelSlug,
          success: data.success,
          roomCount: data.result?.rooms?.length || 0
        }))
      };
      
      // JollyTur dizinine özet kaydet
      const jollyturDir = path.join(process.cwd(), 'src', 'scrapedData', 'jollytur');
      await fs.mkdir(jollyturDir, { recursive: true });
      const summaryPath = path.join(jollyturDir, `${timestamp}_jollytur_scraping_session_summary.json`);
      await fs.writeFile(summaryPath, JSON.stringify(sessionSummary, null, 2));
      
      console.log(`✅ JollyTur kazıma oturumu tamamlandı. ${sessionSummary.successfulScrapes}/${sessionSummary.totalHotels} başarılı.`);
      
    } catch (error) {
      console.error('JollyTur kazıma oturumu hatası:', error);
      throw error;
    } finally {
      // Browser'ı kapat
      await this.jollyturScraper.close();
    }
  }

  /**
   * Touristica.com'dan otel verilerini kazır ve dosyalara kaydeder.
   * @param params Kazıma parametreleri
   */
  async scrapeTouristicaAndSaveToFile(params: {
    hotelSlugs: string[];
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    childAges?: number[];
    headless?: boolean;
  }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Touristica kazıma oturumu başlatılıyor: ${timestamp}`);
    
    try {
      // Touristica scraper'ı başlat
      await this.touristicaScraper.initialize(params.headless ?? true);
      
      const allHotelData: any[] = [];
      
      // Her otel için kazıma yap
      for (const hotelSlug of params.hotelSlugs) {
        try {
          console.log(`Touristica'dan kazınıyor: ${hotelSlug}`);
          
          const searchParams = {
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            adults: params.adults,
            children: params.children || 0,
            childAges: params.childAges || []
          };
          
          const scrapedData = await this.touristicaScraper.scrapeHotelDetails(hotelSlug, searchParams);
          
          if (scrapedData && (scrapedData.odalarVeFiyatlar.length > 0 || scrapedData.fiyatListesi.length > 0)) {
            // Veriyi dosyaya kaydet
            await this.touristicaScraper.saveScrapedData(scrapedData);
            
            const totalItems = scrapedData.odalarVeFiyatlar.length + scrapedData.fiyatListesi.length;
            allHotelData.push({
              success: true,
              hotelSlug,
              hotelName: scrapedData.hotelName,
              roomCount: totalItems,
              result: scrapedData
            });
            
            console.log(`✅ ${hotelSlug}: ${scrapedData.odalarVeFiyatlar.length} ODALAR VE FİYATLAR items, ${scrapedData.fiyatListesi.length} FİYAT LİSTESİ room types found`);
          } else {
            allHotelData.push({
              success: false,
              hotelSlug,
              error: 'No room data found'
            });
            console.log(`❌ ${hotelSlug} kazınamadı: Oda verisi bulunamadı`);
          }
          
        } catch (error) {
          console.error(`❌ ${hotelSlug} kazıma hatası:`, error);
          allHotelData.push({
            success: false,
            hotelSlug,
            timestamp,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Oturum özeti kaydet
      const sessionSummary = {
        timestamp,
        scrapeParameters: params,
        totalHotels: params.hotelSlugs.length,
        successfulScrapes: allHotelData.filter(data => data.success).length,
        failedScrapes: allHotelData.filter(data => !data.success).length,
        hotels: allHotelData.map(data => ({
          hotelSlug: data.hotelSlug,
          success: data.success,
          roomCount: data.result?.rooms?.length || 0
        }))
      };
      
      // Touristica dizinine özet kaydet
      const touristicaDir = path.join(process.cwd(), 'src', 'scrapedData', 'touristica');
      await fs.mkdir(touristicaDir, { recursive: true });
      const summaryPath = path.join(touristicaDir, `${timestamp}_touristica_scraping_session_summary.json`);
      await fs.writeFile(summaryPath, JSON.stringify(sessionSummary, null, 2));
      
      console.log(`✅ Touristica kazıma oturumu tamamlandı. ${sessionSummary.successfulScrapes}/${sessionSummary.totalHotels} başarılı.`);
      
    } catch (error) {
      console.error('Touristica kazıma oturumu hatası:', error);
      throw error;
    } finally {
      // Browser'ı kapat
      await this.touristicaScraper.close();
    }
  }

  /**
   * ScrapedData dizinini temizler (eski dosyaları siler)
   * @param daysToKeep Kaç günlük dosyaları tutacağı (varsayılan 30)
   */
  async cleanupOldFiles(daysToKeep: number = 30): Promise<void> {
    const files = await this.listScrapedFiles();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    for (const file of files) {
      try {
        // Dosya adından tarihi çıkar
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < cutoffDate) {
            const filePath = path.join(this.scrapedDataDir, file);
            await fs.unlink(filePath);
            deletedCount++;
            console.log(`Eski dosya silindi: ${file}`);
          }
        }
      } catch (error) {
        console.error(`Dosya silme hatası (${file}):`, error);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`${deletedCount} eski dosya temizlendi.`);
    }
  }
}