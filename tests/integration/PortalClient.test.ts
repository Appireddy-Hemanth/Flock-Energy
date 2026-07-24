import { PortalClient } from '../../src/client/PortalClient';

describe('PortalClient Integration Tests', () => {
    let client: PortalClient;

    beforeAll(() => {
        jest.setTimeout(30000);
        client = new PortalClient();
    });

    test('should successfully authenticate with the legacy portal', async () => {
        await expect(client.login()).resolves.not.toThrow();
    });

    test('should successfully search for meters', async () => {
        const res = await client.searchMeters('', 1);
        expect(res).toHaveProperty('data');
        expect(res).toHaveProperty('total');
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0]).toHaveProperty('meterId');
    });

    test('should successfully fetch details for J100008', async () => {
        const res = await client.getMeterDetails('J100008');
        expect(res.meterId).toBe('J100008');
        expect(res.serialNo).toBe('SE63900');
        expect(res.make).toBe('Genus');
        expect(res.phaseType).toBe('single');
        expect(res.installStatus).toBe('Installed');
        expect(res.installType).toBe('Whole Current');
        expect(res.hierarchy).toBeDefined();
        expect(res.hierarchy.dt).toContain('Sikar Road DT 9');
    });

    test('should successfully fetch geo location for J100008', async () => {
        const res = await client.getMeterGeo('J100008');
        expect(res).toHaveProperty('data');
        expect(res.data).toHaveProperty('latitude');
        expect(res.data).toHaveProperty('longitude');
    });

    test('should successfully fetch energy consumption readings for J100008', async () => {
        const res = await client.getMeterEnergy('J100008');
        expect(res).toHaveProperty('data');
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0]).toHaveProperty('timestamp');
        expect(res.data[0]).toHaveProperty('kwh');
    });

    test('should successfully fetch transformers (DTs)', async () => {
        const res = await client.getTransformers(1);
        expect(res).toHaveProperty('data');
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0]).toHaveProperty('code');
    });
});
