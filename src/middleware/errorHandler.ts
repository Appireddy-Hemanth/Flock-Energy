import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';
import { logger } from '../utils/logger';

/**
 * Global error handler.
 * Differentiates between known ApiErrors, portal timeouts, and unexpected errors.
 */
export const errorHandler = (
    err: Error | ApiError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Known API errors
    if (err instanceof ApiError) {
        logger.warn(`API Error: ${err.message}`, { statusCode: err.statusCode });
        const body: Record<string, unknown> = { success: false, error: err.message };
        if (err.details) body.details = err.details;
        res.status(err.statusCode).json(body);
        return;
    }

    // Portal timeout / connection errors
    if (err.message?.includes('timeout') || err.message?.includes('ECONNREFUSED')) {
        logger.error('Portal unreachable', { message: err.message });
        res.status(502).json({
            success: false,
            error: 'Portal Unavailable',
            message: 'The upstream Urja Ops portal is unreachable. Please try again later.',
        });
        return;
    }

    // Unexpected errors
    logger.error('Unhandled error', { message: err.message, stack: err.stack });

    const statusCode = (err as any).status || 500;
    const body: Record<string, unknown> = { success: false, error: 'Internal Server Error' };
    if (process.env.NODE_ENV !== 'production') body.stack = err.stack;
    res.status(statusCode).json(body);
};

/**
 * 404 catch-all for undefined /api/* routes.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist.`,
    });
};
