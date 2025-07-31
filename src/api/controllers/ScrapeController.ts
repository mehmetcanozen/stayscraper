// src/api/controllers/ScrapeController.ts

import { Request, Response, NextFunction } from 'express';
import { HotelPriceService } from '../../services/HotelPriceService';

/**
 * ScrapeController: Kazıma işlemlerini yöneten API controller'ı.
 * Bu controller, kazıma işlemlerini tetikler ve sonuçları döndürür.
 */
export class ScrapeController {
  private hotelPriceService: HotelPriceService;

  constructor() {
    this.hotelPriceService = new HotelPriceService();
  }

  /**
   * Etstur için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerEtsturScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelRelativeUrls, checkInDate, checkOutDate, adults, children, childAges } = req.body;

      // Temel parametre doğrulama
      if (!hotelRelativeUrls || hotelRelativeUrls.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelRelativeUrls, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelRelativeUrls, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelRelativeUrls: hotelRelativeUrls as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        children: (children as number) || 0, // Varsayılan çocuk sayısı 0
        childAges: (childAges as number[]) || [], // Varsayılan çocuk yaşları boş dizi
      };

      console.log(`Etstur kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeAndSaveToFile(params);

      console.log('Etstur kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`Etstur kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet (şimdilik bu, console.error olacak)
      next(error);
    }
  }

  /**
   * Obilet için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerObiletScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelNames, checkInDate, checkOutDate, adults, children, childAges } = req.body;

      // Temel parametre doğrulama
      if (!hotelNames || hotelNames.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelNames, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelNames, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelNames: hotelNames as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        children: (children as number) || 0, // Varsayılan çocuk sayısı 0
        childAges: (childAges as number[]) || [], // Varsayılan çocuk yaşları boş dizi
      };

      console.log(`Obilet kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeObiletAndSaveToFile(params);

      console.log('Obilet kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`Obilet kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet
      next(error);
    }
  }

  /**
   * Hotels.com için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerHotelsComScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelNames, checkInDate, checkOutDate, adults, children, childAges } = req.body;

      // Temel parametre doğrulama
      if (!hotelNames || hotelNames.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelNames, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelNames, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelNames: hotelNames as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        children: (children as number) || 0, // Varsayılan çocuk sayısı 0
        childAges: (childAges as number[]) || [], // Varsayılan çocuk yaşları boş dizi
      };

      console.log(`Hotels.com kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeHotelsComAndSaveToFile(params);

      console.log('Hotels.com kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`Hotels.com kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet
      next(error);
    }
  }

  /**
   * JollyTur için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerJollyTurScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelSlugs, checkInDate, checkOutDate, adults, children, childAges, headless } = req.body;

      // Temel parametre doğrulama
      if (!hotelSlugs || hotelSlugs.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelSlugs: hotelSlugs as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        children: (children as number) || 0, // Varsayılan çocuk sayısı 0
        childAges: (childAges as number[]) || [], // Varsayılan çocuk yaşları boş dizi
        headless: (headless as boolean) ?? true, // Varsayılan headless modu true
      };

      console.log(`JollyTur kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeJollyTurAndSaveToFile(params);

      console.log('JollyTur kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`JollyTur kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet
      next(error);
    }
  }

  /**
   * Touristica için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerTouristicaScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelSlugs, checkInDate, checkOutDate, adults, children, childAges, headless } = req.body;

      // Temel parametre doğrulama
      if (!hotelSlugs || hotelSlugs.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelSlugs: hotelSlugs as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        children: (children as number) || 0, // Varsayılan çocuk sayısı 0
        childAges: (childAges as number[]) || [], // Varsayılan çocuk yaşları boş dizi
        headless: (headless as boolean) ?? true, // Varsayılan headless modu true
      };

      console.log(`Touristica kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeTouristicaAndSaveToFile(params);

      console.log('Touristica kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`Touristica kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet
      next(error);
    }
  }

  /**
   * Setur için otel kazıma operasyonunu tetikleyen API endpoint'i.
   * Bu, kazıma işlemini doğrudan (API isteğinden senkron olarak) yürütecektir.
   */
  async triggerSeturScrape(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // İstek gövdesinden parametreleri al
      const { hotelSlugs, checkInDate, checkOutDate, adults, childBirthdates, headless } = req.body;

      // Temel parametre doğrulama
      if (!hotelSlugs || hotelSlugs.length === 0 || !checkInDate || !checkOutDate || adults === undefined) {
        console.error('Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.');
        res.status(400).json({ message: 'Eksik kazıma parametreleri: hotelSlugs, checkInDate, checkOutDate, adults zorunludur.' });
        return;
      }

      const params = {
        hotelSlugs: hotelSlugs as string[], // Tipi belirt
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        adults: adults as number,
        childBirthdates: (childBirthdates as string[]) || [], // Varsayılan çocuk doğum tarihleri boş dizi
        headless: (headless as boolean) ?? true, // Varsayılan headless modu true
      };

      console.log(`Setur kazımasını tetikleme isteği alındı, parametreler: ${JSON.stringify(params)}`);

      // Kazıma servisini doğrudan çağır
      await this.hotelPriceService.scrapeSeturAndSaveToFile(params);

      console.log('Setur kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.');
      res.status(200).json({ message: 'Kazıma operasyonu başarıyla tamamlandı ve veriler dosyaya kaydedildi.' });

    } catch (error: any) {
      console.error(`Setur kazımasını tetiklerken hata oluştu: ${error.message}`);
      // Hatayı Express'in genel hata işleyicisine ilet
      next(error);
    }
  }

  /**
   * Kazınan dosyaları listeler
   */
  async listScrapedFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = await this.hotelPriceService.listScrapedFiles();
      res.status(200).json({
        message: 'Kazınan dosyalar başarıyla listelendi.',
        files: files,
        totalCount: files.length
      });
    } catch (error: any) {
      console.error(`Dosya listesi alınırken hata oluştu: ${error.message}`);
      next(error);
    }
  }

  /**
   * Belirli bir kazınan dosyayı okur
   */
  async readScrapedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileName } = req.params;
      
      if (!fileName) {
        res.status(400).json({ message: 'Dosya adı gerekli.' });
        return;
      }

      const fileData = await this.hotelPriceService.readScrapedFile(fileName);
      
      if (!fileData) {
        res.status(404).json({ message: 'Dosya bulunamadı veya okunamadı.' });
        return;
      }

      res.status(200).json({
        message: 'Dosya başarıyla okundu.',
        fileName: fileName,
        data: fileData
      });
    } catch (error: any) {
      console.error(`Dosya okuma hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * En son kazıma oturumunu getirir
   */
  async getLatestSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await this.hotelPriceService.getLatestSession();
      
      if (!session) {
        res.status(404).json({ message: 'Henüz kazıma oturumu bulunamadı.' });
        return;
      }

      res.status(200).json({
        message: 'En son kazıma oturumu başarıyla getirildi.',
        session: session
      });
    } catch (error: any) {
      console.error(`Oturum getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Belirli bir tarihteki kazıma oturumlarını getirir
   */
  async getSessionsByDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.params;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: 'Geçerli bir tarih gerekli (YYYY-MM-DD formatında).' });
        return;
      }

      const sessions = await this.hotelPriceService.getSessionsByDate(date);
      
      res.status(200).json({
        message: 'Tarih bazlı oturumlar başarıyla getirildi.',
        date: date,
        sessions: sessions,
        totalCount: sessions.length
      });
    } catch (error: any) {
      console.error(`Tarih bazlı oturum getirme hatası: ${error.message}`);
      next(error);
    }
  }

  /**
   * Eski dosyaları temizler
   */
  async cleanupOldFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { daysToKeep } = req.query;
      const days = daysToKeep ? parseInt(daysToKeep as string) : 30;
      
      await this.hotelPriceService.cleanupOldFiles(days);
      
      res.status(200).json({
        message: 'Eski dosyalar başarıyla temizlendi.',
        daysToKeep: days
      });
    } catch (error: any) {
      console.error(`Dosya temizleme hatası: ${error.message}`);
      next(error);
    }
  }
}
