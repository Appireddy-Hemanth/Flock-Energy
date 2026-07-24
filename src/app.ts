import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/api';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Ensure .env is parsed
dotenv.config();

const app = express();

// ─── Security ────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP so Swagger UI loads its own assets
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate limiting ──────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 60 * 1000,      // 1-minute window
    max: 100,                  // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// ─── Body parsing ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request logging ────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.url}`, { ip: req.ip });
    next();
});

// ─── Swagger / OpenAPI documentation ────────────────────────────
const swaggerOptions: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Urja Ops Portal REST API Wrapper',
            version: '1.0.0',
            description:
                'A read-only REST API wrapper built over the reverse-engineered Urja Ops legacy portal. ' +
                'Exposes meters, search, meter details, consumption, and network hierarchy endpoints.',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}/api`,
                description: 'Local development server',
            },
        ],
        tags: [
            { name: 'Meters', description: 'Meter listing, details, and search operations' },
            { name: 'Consumption', description: 'Historical energy consumption data' },
            { name: 'Network', description: 'Distribution transformer hierarchy' },
            { name: 'Health', description: 'Service health and connectivity checks' },
        ],
    },
    apis: [
        path.join(__dirname, './routes/**/*.ts').replace(/\\/g, '/'),
        path.join(__dirname, './routes/**/*.js').replace(/\\/g, '/'),
    ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// ─── Static web dashboard ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API routes ─────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Error handling ─────────────────────────────────────────────
app.use('/api', notFoundHandler);
app.use(errorHandler);

export default app;
