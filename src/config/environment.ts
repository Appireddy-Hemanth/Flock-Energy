import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
    port: parseInt(process.env.PORT || '3000', 10),
    portalEmail: process.env.PORTAL_EMAIL || '',
    portalPassword: process.env.PORTAL_PASSWORD || '',
    portalBaseUrl: process.env.PORTAL_BASE_URL || 'https://urja-ops.flockenergy.tech',
    nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate that important variables are defined
if (!env.portalEmail || !env.portalPassword) {
    logger.warn('PORTAL_EMAIL and PORTAL_PASSWORD environment variables are not fully configured.');
}
