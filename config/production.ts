import { defaultConfig, AppConfig } from './default';

export const productionConfig: AppConfig = {
  ...defaultConfig,
  nodeEnv: 'production',
  puppeteer: {
    ...defaultConfig.puppeteer,
    headless: true, // Always headless in production
    slowMo: 0 // No delays in production
  },
  scraping: {
    ...defaultConfig.scraping,
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10') // More concurrent jobs in production
  },
  logging: {
    level: 'warn',
    format: 'json'
  }
};
