// src/api/routes/scrapeRoutes.ts

import { Router } from 'express';
import { ScrapeController } from '../controllers/ScrapeController';

const router = Router();
const scrapeController = new ScrapeController();

// POST /api/scrape/etstur - Etstur için bir kazıma operasyonunu tetikler
router.post('/etstur', scrapeController.triggerEtsturScrape.bind(scrapeController));

// POST /api/scrape/obilet - Obilet için bir kazıma operasyonunu tetikler
router.post('/obilet', scrapeController.triggerObiletScrape.bind(scrapeController));

// POST /api/scrape/hotelscom - Hotels.com için bir kazıma operasyonunu tetikler
router.post('/hotelscom', scrapeController.triggerHotelsComScrape.bind(scrapeController));

// POST /api/scrape/setur - Setur için bir kazıma operasyonunu tetikler
router.post('/setur', scrapeController.triggerSeturScrape.bind(scrapeController));

// POST /api/scrape/jollytur - JollyTur için bir kazıma operasyonunu tetikler
router.post('/jollytur', scrapeController.triggerJollyTurScrape.bind(scrapeController));

// POST /api/scrape/touristica - Touristica için bir kazıma operasyonunu tetikler
router.post('/touristica', scrapeController.triggerTouristicaScrape.bind(scrapeController));

// GET /api/scrape/files - Kazınan dosyaları listeler
router.get('/files', scrapeController.listScrapedFiles.bind(scrapeController));

// GET /api/scrape/files/:fileName - Belirli bir kazınan dosyayı okur
router.get('/files/:fileName', scrapeController.readScrapedFile.bind(scrapeController));

// GET /api/scrape/sessions/latest - En son kazıma oturumunu getirir
router.get('/sessions/latest', scrapeController.getLatestSession.bind(scrapeController));

// GET /api/scrape/sessions/date/:date - Belirli bir tarihteki kazıma oturumlarını getirir
router.get('/sessions/date/:date', scrapeController.getSessionsByDate.bind(scrapeController));

// DELETE /api/scrape/cleanup - Eski dosyaları temizler
router.delete('/cleanup', scrapeController.cleanupOldFiles.bind(scrapeController));

export default router;
