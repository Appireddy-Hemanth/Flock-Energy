import app from './app';
import { env } from './config/environment';
import { logger } from './utils/logger';

const PORT = env.port;
const HOST = env.host;
const docsUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}/docs` : `http://${HOST}:${PORT}/docs`;

app.listen(PORT, HOST, () => {
    logger.info('✓ Urja Ops Portal REST API Wrapper is running', { 
        host: HOST, 
        port: PORT, 
        docs: docsUrl,
        environment: env.nodeEnv,
    });
});
