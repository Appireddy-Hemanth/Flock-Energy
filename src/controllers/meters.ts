import { Request, Response, NextFunction } from 'express';
import { MeterService } from '../services/MeterService';
import { PortalClient } from '../client/PortalClient';
import { successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const portalClient = new PortalClient();
const meterService = new MeterService(portalClient);

export { portalClient };

export class MetersController {

    /**
     * GET /meters
     * Returns paginated list of meters.
     */
    public static async getMeters(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = Number(req.query.page) || 1;
            const query = (req.query.q as string) || '';
            const result = await meterService.listMeters(query, page, {
                make: req.query.make as string | undefined,
                status: req.query.status as string | undefined,
                dtCode: req.query.dtCode as string | undefined,
                phaseType: req.query.phaseType as string | undefined,
                sortBy: req.query.sortBy as string | undefined,
                sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined),
            });
            res.json(successResponse(result.meters, result.meta));
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /search?q=<query>
     * Search for meters by query string.
     */
    public static async searchMeters(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const q = (req.query.q as string) || '';
            const page = Number(req.query.page) || 1;
            const result = await meterService.searchMeters(q, page, {
                make: req.query.make as string | undefined,
                status: req.query.status as string | undefined,
                dtCode: req.query.dtCode as string | undefined,
                phaseType: req.query.phaseType as string | undefined,
                sortBy: req.query.sortBy as string | undefined,
                sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined),
            });
            res.json(successResponse(result.meters, result.meta));
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /export?format=json|csv
     * Exports the current meter catalog for download.
     */
    public static async exportMeters(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const format = (req.query.format as string || 'json').toLowerCase();
            const q = (req.query.q as string) || '';
            const filterOptions = {
                make: req.query.make as string | undefined,
                status: req.query.status as string | undefined,
                dtCode: req.query.dtCode as string | undefined,
                phaseType: req.query.phaseType as string | undefined,
                sortBy: req.query.sortBy as string | undefined,
                sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined),
            };

            const meters = await meterService.exportMeters(q, filterOptions);

            if (format === 'csv') {
                const lines = [
                    'meterId,serialNo,make,phaseType,installStatus,dtCode',
                    ...meters.map((meter) => [
                        meter.meterId,
                        meter.serialNo,
                        meter.make,
                        meter.phaseType,
                        meter.installStatus,
                        meter.dtCode,
                    ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')),
                ];
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="meters.csv"');
                res.send(lines.join('\n'));
                return;
            }

            res.json(successResponse(meters, { page: 1, pageSize: meters.length, total: meters.length }));
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /meters/:id
     * Returns merged meter details with geo coordinates and hierarchy.
     */
    public static async getMeterById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id as string;
            logger.debug('----------------------------------------');
            logger.info(`Incoming Request: GET /meters/${id}`);
            logger.debug(`Parameters -> id: ${id}`);
            const detail = await meterService.getMeterById(id);
            const responseJSON = successResponse(detail);
            logger.debug(`Returning JSON response for /meters/${id}`);
            res.json(responseJSON);
        } catch (error) {
            logger.error(`[Trace: Controller] Caught Error: ${(error as Error).message}`);
            next(error);
        }
    }

    /**
     * GET /meters/:id/consumption
     * Returns formatted energy consumption readings.
     */
    public static async getMeterConsumption(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id as string;
            const readings = await meterService.getConsumption(id);
            res.json(successResponse(readings));
        } catch (error) {
            next(error);
        }
    }
}
