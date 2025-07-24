import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
const envFile = path.resolve(process.cwd(), `.env.${environment}`);

// Load the environment-specific .env file
dotenv.config({ path: envFile });

// Also load the default .env file if it exists
dotenv.config();

import { defaultConfig, AppConfig } from './default';
import { developmentConfig } from './development';
import { productionConfig } from './production';

let config: AppConfig;

switch (environment) {
  case 'production':
    config = productionConfig;
    break;
  case 'development':
    config = developmentConfig;
    break;
  default:
    config = defaultConfig;
    break;
}

export { config };
export type { AppConfig } from './default';
