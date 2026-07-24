import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

// Load .env if present; support deployment platforms that inject environment variables directly.
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    portalEmail: process.env.PORTAL_EMAIL || '',
    portalPassword: process.env.PORTAL_PASSWORD || '',
    portalBaseUrl: process.env.PORTAL_BASE_URL || 'https://urja-ops.flockenergy.tech',
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
};

// Validate that important variables are defined
export function validateEnvironment() {
    const errors: string[] = [];
    
    if (!env.portalEmail) {
        errors.push('PORTAL_EMAIL environment variable is not configured');
    }
    if (!env.portalPassword) {
        errors.push('PORTAL_PASSWORD environment variable is not configured');
    }
    if (!env.portalBaseUrl) {
        errors.push('PORTAL_BASE_URL environment variable is not configured');
    }
    
    if (errors.length > 0) {
        logger.warn('Environment validation warnings', { warnings: errors });
    }
    
    logger.info('Environment configuration loaded', {
        port: env.port,
        host: env.host,
        nodeEnv: env.nodeEnv,
        portalBaseUrl: env.portalBaseUrl,
        portalEmailConfigured: !!env.portalEmail,
        portalPasswordConfigured: !!env.portalPassword,
        corsOrigin: env.corsOrigin,
    });
    
    return errors.length === 0;
}
