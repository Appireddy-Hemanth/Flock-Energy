import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            req.body = parsed.body;
            req.query = parsed.query;
            req.params = parsed.params;
            next();
        } catch (error: any) {
            res.status(400).json({
                error: 'Validation failed',
                details: error.errors || error.message,
            });
        }
    };
};
