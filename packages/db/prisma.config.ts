import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../apps/web/.env') });
dotenv.config();

export default defineConfig({ 
  datasource: { 
    url: process.env.DATABASE_URL, 
    directUrl: process.env.DIRECT_URL, 
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
});

