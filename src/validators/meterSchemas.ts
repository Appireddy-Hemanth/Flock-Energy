import { z } from 'zod';

export const searchMetersSchema = z.object({
    query: z.object({
        q: z.string().optional().default(''),
        page: z
            .string()
            .optional()
            .default('1')
            .transform((val) => {
                const parsed = parseInt(val, 10);
                return isNaN(parsed) || parsed < 1 ? 1 : parsed;
            }),
        make: z.string().optional(),
        status: z.string().optional(),
        dtCode: z.string().optional(),
        phaseType: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
    }),
});

export const getMeterParamsSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'Meter ID/Code must be specified'),
    }),
});
