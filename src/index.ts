// src/index.ts

import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv'; // Ortam değişkenlerini yüklemek için
import scrapeRoutes from '@api/routes/scrapeRoutes'; // Kazıma rotalarını içe aktar

// .env dosyasındaki ortam değişkenlerini yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Ortam değişkeninden portu al, yoksa 3000 kullan

// Uygulama bileşenlerini başlatma fonksiyonu
async function bootstrap() {
  try {
    // Middleware kurulumu
    app.use(express.json()); // JSON istek gövdelerini ayrıştır
    app.use(compression());  // Yanıtları sıkıştır
    app.use(cors());         // CORS'u etkinleştir
    app.use(helmet());       // Güvenlik başlıkları ekle

    // API Rotaları
    app.get('/', (req: Request, res: Response) => {
      res.send('StayScraper API çalışıyor!');
    });
    app.get('/health', (req: Request, res: Response) => {
      res.status(200).send('OK');
    });
    app.use('/api/scrape', scrapeRoutes); // Kazıma rotalarını '/api/scrape' altına bağla

    // Geçici genel hata işleme middleware'i (henüz tam errorHandler kurulmadığı için)
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`İşlenmemiş Hata: ${err.message}`, err.stack);
      res.status(500).send('Sunucu tarafında beklenmeyen bir hata oluştu!');
    });

    // Express sunucusunu başlat
    const server = app.listen(PORT, () => {
      console.log(`StayScraper API sunucusu ${PORT} portunda dinlemede.`);
      console.log(`API'ye şu adresten erişilebilir: http://localhost:${PORT}`);
    });

    // Uygulamanın düzgün kapanması için sinyal işleme
    process.on('SIGTERM', async () => {
      console.log('SIGTERM sinyali alındı: HTTP sunucusu kapatılıyor.');
      server.close(() => {
        console.log('HTTP sunucusu kapatıldı.');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT sinyali alındı: HTTP sunucusu kapatılıyor.');
      server.close(() => {
        console.log('HTTP sunucusu kapatıldı.');
        process.exit(0);
      });
    });

  } catch (error: any) {
    console.error(`Uygulama başlatma başarısız oldu: ${error.message}`);
    process.exit(1); // Başlatma başarısız olursa uygulamadan çık
  }
}

// Uygulamayı başlat
bootstrap();