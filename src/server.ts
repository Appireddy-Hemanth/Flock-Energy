import app from './app';
import { env } from './config/environment';
import { logger } from './utils/logger';

const PORT = env.port || 3000;

app.listen(PORT, () => {
    logger.info('Urja Ops Portal REST API Wrapper successfully active!', { port: PORT, docs: `http://localhost:${PORT}/docs` });
});
