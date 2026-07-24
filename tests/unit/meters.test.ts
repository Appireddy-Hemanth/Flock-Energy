import request from 'supertest';
import app from '../../src/app';
import { PortalClient } from '../../src/client/PortalClient';
import { MeterService } from '../../src/services/MeterService';
import { ApiError } from '../../src/types';

// Auto-mock the module, converting all prototype methods to jest.fn()
jest.mock('../../src/client/PortalClient');

describe('Meters Controllers Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock returns to avoid undefined crashes
        (PortalClient.prototype.getMeterGeo as jest.Mock).mockResolvedValue({
            data: { latitude: '0', longitude: '0' }
        });
        (PortalClient.prototype.getMeterDetails as jest.Mock).mockResolvedValue({
            meterId: 'J100008',
            serialNo: 'SE63900',
            make: 'Genus',
            phaseType: 'single',
            installStatus: 'Installed',
            installType: 'Whole Current',
            hierarchy: {}
        });
        (PortalClient.prototype.isAuthenticated as jest.Mock).mockReturnValue(false);
    });

    test('MeterService should fall back to a bundled catalog when portal search fails', async () => {
        const portal = {
            searchMeters: jest.fn().mockRejectedValue(new Error('Portal blocked')),
        } as unknown as PortalClient;

        const service = new MeterService(portal);
        const result = await service.listMeters('', 1);

        expect(result.meters.length).toBeGreaterThan(0);
        expect(result.meters[0]).toHaveProperty('meterId');
        expect(result.meters[0].meterId).toBe('J100000');
    });

    test('GET /api/meters - should return list of meters wrapped in envelope', async () => {
        const mockMeters = [
            { meterId: 'M1', serialNo: 'S1', make: 'M', phaseType: 'single', installStatus: 'Active', dtCode: 'DT1' }
        ];
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({
            data: mockMeters,
            total: 1,
            page: 1,
            pageSize: 20
        });

        const res = await request(app).get('/api/meters?page=1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockMeters);
        expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
        expect(PortalClient.prototype.searchMeters).toHaveBeenCalledWith('', 1);
    });

    test('GET /api/meters - validation normalizes negative page to 1', async () => {
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });
        const res = await request(app).get('/api/meters?page=-5');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('GET /api/search - should forward query parameter q', async () => {
        const mockMeters = [
            { meterId: 'M1', serialNo: 'S1', make: 'Genus', phaseType: 'single', installStatus: 'Active', dtCode: 'DT1' }
        ];
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({
            data: mockMeters,
            total: 1,
            page: 2,
            pageSize: 20
        });

        const res = await request(app).get('/api/search?q=Genus&page=2');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockMeters);
        expect(PortalClient.prototype.searchMeters).toHaveBeenCalledWith('Genus', 2);
    });

    test('GET /api/meters/:id - should merge details and geo data in envelope', async () => {
        (PortalClient.prototype.getMeterDetails as jest.Mock).mockResolvedValue({
            meterId: 'J100008',
            serialNo: 'SE63900',
            make: 'Genus',
            phaseType: 'single',
            installStatus: 'Installed',
            installType: 'Whole Current',
            hierarchy: { zone: 'Z1', circle: 'C1', division: 'D1', subdivision: 'SD1', substation: 'SS1', feeder: 'F1', dt: 'DT1' }
        });
        (PortalClient.prototype.getMeterGeo as jest.Mock).mockResolvedValue({
            data: { latitude: '26.899010', longitude: '75.840067' }
        });

        const res = await request(app).get('/api/meters/J100008');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual({
            meterId: 'J100008',
            serialNo: 'SE63900',
            make: 'Genus',
            phaseType: 'single',
            installStatus: 'Installed',
            installType: 'Whole Current',
            dtCode: 'DT1',
            coordinates: { latitude: 26.899010, longitude: 75.840067 },
            hierarchy: { zone: 'Z1', circle: 'C1', division: 'D1', subdivision: 'SD1', substation: 'SS1', feeder: 'F1', dt: 'DT1' }
        });
    });

    test('GET /api/meters/:id/consumption - should format response with envelope', async () => {
        (PortalClient.prototype.getMeterEnergy as jest.Mock).mockResolvedValue({
            data: [
                { timestamp: '23/06/2026 23:30', kwh: '27623.95', kvah: '29833.87', voltR: '227' }
            ]
        });

        const res = await request(app).get('/api/meters/J100008/consumption');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([
            {
                timestamp: '2026-06-23T23:30:00.000Z',
                kwh: 27623.95,
                kvah: 29833.87,
                voltage: 227
            }
        ]);
    });

    test('GET /api/meters/:id/consumption - should return empty data when portal payload is not an array', async () => {
        (PortalClient.prototype.getMeterEnergy as jest.Mock).mockResolvedValue({
            data: { error: 'Portal rejected the request' }
        });

        const res = await request(app).get('/api/meters/J100008/consumption');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
    });

    test('GET /api/network - should group meters under transformers', async () => {
        (PortalClient.prototype.getTransformers as jest.Mock).mockResolvedValue({
            data: [
                { code: 'DT1', name: 'Transformer 1', feederCode: 'F1', capacityKva: 100 }
            ],
            total: 1,
            page: 1,
            pageSize: 20
        });
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({
            data: [
                { meterId: 'M1', serialNo: 'S1', make: 'Make1', phaseType: 'single', installStatus: 'Active', dtCode: 'DT1' }
            ],
            total: 1,
            page: 1,
            pageSize: 20
        });

        const res = await request(app).get('/api/network');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([
            {
                code: 'DT1',
                name: 'Transformer 1',
                feederCode: 'F1',
                capacityKva: 100,
                meters: [
                    { meterId: 'M1', serialNo: 'S1', make: 'Make1', phaseType: 'single', installStatus: 'Active' }
                ]
            }
        ]);
    });

    test('GET /api/meters/:id - should fallback to 0,0 coordinates if geo fails', async () => {
        (PortalClient.prototype.getMeterDetails as jest.Mock).mockResolvedValue({
            meterId: 'J100008',
            serialNo: 'SE63900',
            make: 'Genus',
            phaseType: 'single',
            installStatus: 'Installed',
            installType: 'Whole Current',
            hierarchy: { zone: 'Z1', circle: 'C1', division: 'D1', subdivision: 'SD1', substation: 'SS1', feeder: 'F1', dt: 'DT1' }
        });
        (PortalClient.prototype.getMeterGeo as jest.Mock).mockRejectedValue(new Error('Geo API failed'));

        const res = await request(app).get('/api/meters/J100008');
        expect(res.status).toBe(200);
        expect(res.body.data.coordinates).toEqual({ latitude: 0, longitude: 0 });
    });

    test('GET /api/meters/:id - should return 500 when portal call fails', async () => {
        (PortalClient.prototype.getMeterDetails as jest.Mock).mockRejectedValue(new Error('Auth failed'));
        const res = await request(app).get('/api/meters/J100008');
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
    });

    test('GET /api/health - should return status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('uptime');
    });

    test('GET /api/health - should include richer metadata', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('service');
        expect(res.body.data).toHaveProperty('version');
        expect(res.body.data).toHaveProperty('timestamp');
        expect(res.body.data).toHaveProperty('portalAuthenticated');
    });

    test('GET /api/export?format=json - should return exported meter payload', async () => {
        const mockMeters = [
            { meterId: 'M1', serialNo: 'S1', make: 'Genus', phaseType: 'single', installStatus: 'Active', dtCode: 'DT1' }
        ];
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({
            data: mockMeters,
            total: 1,
            page: 1,
            pageSize: 20
        });

        const res = await request(app).get('/api/export?format=json');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(mockMeters);
    });

    test('GET /api/export?format=csv - should return CSV attachment with correct headers', async () => {
        const mockMeters = [
            { meterId: 'M1', serialNo: 'S1', make: 'Genus', phaseType: 'single', installStatus: 'Active', dtCode: 'DT1' }
        ];
        (PortalClient.prototype.searchMeters as jest.Mock).mockResolvedValue({
            data: mockMeters,
            total: 1,
            page: 1,
            pageSize: 20
        });

        const res = await request(app).get('/api/export?format=csv');
        expect(res.status).toBe(200);
        expect(res.header['content-type']).toMatch(/text\/csv/);
        expect(res.header['content-disposition']).toMatch(/attachment; filename=\"meters.csv\"/);
        // CSV body should include header row and meter id
        expect(res.text).toMatch(/meterId,serialNo,make,phaseType,installStatus,dtCode/);
        expect(res.text).toMatch(/M1/);
    });

    test('GET /api/meters/:id - should return 404 when portal returns not found', async () => {
        (PortalClient.prototype.getMeterDetails as jest.Mock).mockRejectedValue(new ApiError(404, 'Meter not found'));
        (PortalClient.prototype.getMeterGeo as jest.Mock).mockResolvedValue({ data: { latitude: '0', longitude: '0' } });

        const res = await request(app).get('/api/meters/UNKNOWN');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body).toHaveProperty('error');
    });
});
