import { databaseConfig } from './db.config';
import { redisConfig } from './redis.config';
import { puppeteerConfig } from './puppeteer.config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: typeof databaseConfig;
  redis: typeof redisConfig;
  puppeteer: typeof puppeteerConfig;
  scraping: {
    maxConcurrentJobs: number;
    jobTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

export const defaultConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: databaseConfig,
  redis: redisConfig,
  puppeteer: puppeteerConfig,
  scraping: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '5'),
    jobTimeout: parseInt(process.env.JOB_TIMEOUT || '300000'), // 5 minutes
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000') // 5 seconds
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};
