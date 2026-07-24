import { PortalClient } from '../client/PortalClient';
import { NetworkNode } from '../types';

/**
 * Business-logic service for network hierarchy operations.
 * Assembles the transformer → meter tree using concurrent page fetching.
 */
export class NetworkService {
    constructor(private readonly portal: PortalClient) { }

    /**
     * Builds a full network tree of transformers with their child meters.
     */
    async getNetworkTree(): Promise<NetworkNode[]> {
        // 1. Fetch all transformers (paginated)
        const dtPage1 = await this.portal.getTransformers(1);
        const pageSize = dtPage1.pageSize || 20;
        const numDtPages = Math.ceil(dtPage1.total / pageSize);

        const dtPromises = [];
        for (let p = 2; p <= numDtPages; p++) {
            dtPromises.push(this.portal.getTransformers(p).catch(() => ({ data: [] })));
        }
        const otherDtPages = await Promise.all(dtPromises);
        const allTransformers = [
            ...dtPage1.data,
            ...otherDtPages.flatMap((r: any) => r.data),
        ];

        // 2. Fetch all meters (paginated)
        const meterPage1 = await this.portal.searchMeters('', 1);
        const meterPageSize = meterPage1.pageSize || 20;
        const numMeterPages = Math.ceil(meterPage1.total / meterPageSize);

        const meterPromises = [];
        for (let p = 2; p <= numMeterPages; p++) {
            meterPromises.push(this.portal.searchMeters('', p).catch(() => ({ data: [] })));
        }
        const otherMeterPages = await Promise.all(meterPromises);
        const allMeters = [
            ...meterPage1.data,
            ...otherMeterPages.flatMap((r: any) => r.data),
        ];

        // 3. Group meters by DT code
        const metersByDt = new Map<string, any[]>();
        for (const meter of allMeters) {
            if (!meter.dtCode) continue;
            if (!metersByDt.has(meter.dtCode)) {
                metersByDt.set(meter.dtCode, []);
            }
            metersByDt.get(meter.dtCode)!.push({
                meterId: meter.meterId,
                serialNo: meter.serialNo,
                make: meter.make,
                phaseType: meter.phaseType,
                installStatus: meter.installStatus,
            });
        }

        // 4. Assemble tree
        return allTransformers.map((dt) => ({
            code: dt.code,
            name: dt.name,
            feederCode: dt.feederCode,
            capacityKva: dt.capacityKva,
            meters: metersByDt.get(dt.code) || [],
        }));
    }
}
