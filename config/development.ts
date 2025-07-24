import { defaultConfig, AppConfig } from './default';

export const developmentConfig: AppConfig = {
  ...defaultConfig,
  nodeEnv: 'development',
  puppeteer: {
    ...defaultConfig.puppeteer,
    headless: false, // Show browser in development for debugging
    slowMo: 100 // Slow down actions for debugging
  },
  logging: {
    level: 'debug',
    format: 'dev'
  }
};
