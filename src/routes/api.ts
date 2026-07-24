import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { MetersController, portalClient } from '../controllers/meters';
import { NetworkController } from '../controllers/network';
import { validate } from '../middleware/validate';
import { searchMetersSchema, getMeterParamsSchema } from '../validators/meterSchemas';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Service health check
 *     description: Returns API status and portal connectivity information.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 portalAuthenticated:
 *                   type: boolean
 *                   example: true
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 */
router.get('/health', (_req: Request, res: Response) => {
    const data = {
        service: 'flock-energy-urja-api',
        version: '1.0.0',
        portalAuthenticated: portalClient.isAuthenticated(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };

    res.json(successResponse(data));
});

/**
 * @swagger
 * /meters:
 *   get:
 *     summary: List all meters
 *     description: Returns a paginated list of meters from the legacy portal catalog.
 *     tags: [Meters]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: Paginated list of meters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       meterId:
 *                         type: string
 *                         example: J100008
 *                       serialNo:
 *                         type: string
 *                         example: SE63900
 *                       make:
 *                         type: string
 *                         example: Genus
 *                       phaseType:
 *                         type: string
 *                         example: single
 *                       installStatus:
 *                         type: string
 *                         example: Installed
 *                       dtCode:
 *                         type: string
 *                         example: DT-009
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 403
 *       400:
 *         description: Validation error
 *       502:
 *         description: Portal unavailable
 */
router.get(
    '/meters',
    validate(searchMetersSchema),
    MetersController.getMeters
);

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Search meters
 *     description: Search the meter catalog by meter ID, serial number, make, or other attributes.
 *     tags: [Meters]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (meter ID, serial number, make, etc.)
 *         example: Genus
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: Search results matching query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MeterSummary'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       400:
 *         description: Validation error
 *       502:
 *         description: Portal unavailable
 */
router.get(
    '/search',
    validate(searchMetersSchema),
    MetersController.searchMeters
);

/**
 * @swagger
 * /export:
 *   get:
 *     summary: Export meters
 *     description: Export meters in `json` or `csv` format using the same filters as the listing endpoints.
 *     tags: [Meters]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format (json|csv)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: make
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: dtCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: phaseType
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Exported meters (JSON envelope or CSV attachment)
 *       400:
 *         description: Validation error
 *       502:
 *         description: Portal unavailable
 */
router.get('/export', MetersController.exportMeters);

/**
 * @swagger
 * /meters/{id}:
 *   get:
 *     summary: Get meter details
 *     description: Returns full meter metadata including serial number, make, install type, geo coordinates, and network hierarchy.
 *     tags: [Meters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Meter ID (e.g., J100008)
 *         example: J100008
 *     responses:
 *       200:
 *         description: Meter details with coordinates and hierarchy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     meterId:
 *                       type: string
 *                       example: J100008
 *                     serialNo:
 *                       type: string
 *                       example: SE63900
 *                     make:
 *                       type: string
 *                       example: Genus
 *                     phaseType:
 *                       type: string
 *                       example: single
 *                     installStatus:
 *                       type: string
 *                       example: Installed
 *                     installType:
 *                       type: string
 *                       example: Whole Current
 *                     coordinates:
 *                       type: object
 *                       properties:
 *                         latitude:
 *                           type: number
 *                           example: 26.899010
 *                         longitude:
 *                           type: number
 *                           example: 75.840067
 *                     hierarchy:
 *                       type: object
 *                       properties:
 *                         zone:
 *                           type: string
 *                         circle:
 *                           type: string
 *                         division:
 *                           type: string
 *                         subdivision:
 *                           type: string
 *                         substation:
 *                           type: string
 *                         feeder:
 *                           type: string
 *                         dt:
 *                           type: string
 *       400:
 *         description: Validation error (invalid meter ID)
 *       500:
 *         description: Internal server error
 *       502:
 *         description: Portal unavailable
 */
router.get(
    '/meters/:id',
    validate(getMeterParamsSchema),
    MetersController.getMeterById
);

/**
 * @swagger
 * /meters/{id}/consumption:
 *   get:
 *     summary: Get consumption readings
 *     description: Returns historical energy consumption readings with ISO timestamps, kWh, kVAh, and voltage values.
 *     tags: [Consumption]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Meter ID (e.g., J100008)
 *         example: J100008
 *     responses:
 *       200:
 *         description: Array of consumption readings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-06-23T23:30:00.000Z"
 *                       kwh:
 *                         type: number
 *                         example: 27623.95
 *                       kvah:
 *                         type: number
 *                         example: 29833.87
 *                       voltage:
 *                         type: number
 *                         example: 227
 *       400:
 *         description: Validation error (invalid meter ID)
 *       502:
 *         description: Portal unavailable
 */
router.get(
    '/meters/:id/consumption',
    validate(getMeterParamsSchema),
    MetersController.getMeterConsumption
);

/**
 * @swagger
 * /network:
 *   get:
 *     summary: Get distribution network tree
 *     description: Returns the full hierarchical tree of distribution transformers (DTs) with their child meters. Fetches all pages concurrently for speed.
 *     tags: [Network]
 *     responses:
 *       200:
 *         description: Network tree of transformers with grouped meters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         example: DT-001
 *                       name:
 *                         type: string
 *                         example: Malviya Nagar DT 1
 *                       feederCode:
 *                         type: string
 *                         example: F-001
 *                       capacityKva:
 *                         type: number
 *                         example: 100
 *                       meters:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             meterId:
 *                               type: string
 *                             serialNo:
 *                               type: string
 *                             make:
 *                               type: string
 *                             phaseType:
 *                               type: string
 *                             installStatus:
 *                               type: string
 *       502:
 *         description: Portal unavailable
 */
router.get(
    '/network',
    NetworkController.getNetworkLayout
);

export default router;
