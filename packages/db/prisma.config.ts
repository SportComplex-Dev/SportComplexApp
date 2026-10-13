import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(__dirname, '../../apps/web/.env.local'));
} catch {}
try {
  process.loadEnvFile(path.resolve(__dirname, '../../apps/web/.env'));
} catch {}
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({ 
  datasource: { 
    url: process.env.DATABASE_URL, 
    directUrl: process.env.DIRECT_URL, 
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
});

