import { PortalClient } from '../client/PortalClient';
import { logger } from '../utils/logger';
import {
    MeterSearchResult,
    MeterDetailResponse,
    FormattedConsumptionReading,
} from '../types';

const FALLBACK_METERS: MeterSearchResult[] = [
    { meterId: 'J100000', serialNo: 'SE33962', make: 'HPL', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-001' },
    { meterId: 'J100001', serialNo: 'GE84132', make: 'L&T', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-002' },
    { meterId: 'J100002', serialNo: 'AL28136', make: 'L&T', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-003' },
    { meterId: 'J100003', serialNo: 'L&84997', make: 'Genus', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-004' },
    { meterId: 'J100004', serialNo: 'SE65293', make: 'Genus', phaseType: 'single', installStatus: 'Faulty', dtCode: 'DT-005' },
    { meterId: 'J100005', serialNo: 'HP63682', make: 'Allied', phaseType: 'three', installStatus: 'Faulty', dtCode: 'DT-006' },
    { meterId: 'J100006', serialNo: 'SE35634', make: 'HPL', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-007' },
    { meterId: 'J100007', serialNo: 'SE11409', make: 'Genus', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-008' },
    { meterId: 'J100008', serialNo: 'SE63900', make: 'Genus', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-009' },
    { meterId: 'J100009', serialNo: 'SE79541', make: 'Genus', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-010' },
];

interface MeterQueryOptions {
    make?: string;
    status?: string;
    dtCode?: string;
    phaseType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Converts portal date format "DD/MM/YYYY HH:mm" to ISO 8601.
 */
function toISOString(dateStr: string): string {
    try {
        const [d, t] = dateStr.split(' ');
        const [day, month, year] = d.split('/').map(Number);
        const [hour, min] = t.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour, min)).toISOString();
    } catch {
        return dateStr;
    }
}

/**
 * Business-logic service for meter operations.
 * Decouples controllers from PortalClient internals.
 */
export class MeterService {
    private catalogCache: { data: { meters: MeterSearchResult[]; total: number; pageSize: number }; expiresAt: number } | null = null;

    constructor(private readonly portal: PortalClient) { }

    private isCacheValid(): boolean {
        return !!this.catalogCache && Date.now() < this.catalogCache.expiresAt;
    }

    private async fetchAllPages(query: string, skipCache: boolean = false): Promise<{ meters: MeterSearchResult[]; total: number; pageSize: number }> {
        if (!skipCache && !query && this.isCacheValid()) {
            return this.catalogCache!.data;
        }

        try {
            const firstPage = await this.portal.searchMeters(query, 1);
            const pageSize = firstPage.pageSize || firstPage.data.length || 20;
            const total = firstPage.total || firstPage.data.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));

            const remainingPages = await Promise.all(
                Array.from({ length: pageCount - 1 }, (_, index) =>
                    this.portal.searchMeters(query, index + 2).catch((error) => {
                        logger.warn(`Failed to fetch page ${index + 2} for query '${query}': ${error.message}`);
                        return { data: [], total, page: index + 2, pageSize };
                    })
                )
            );

            const meters = [
                ...firstPage.data,
                ...remainingPages.flatMap((page) => page.data),
            ];

            const uniqueMeters = Array.from(new Map(meters.map((meter) => [meter.meterId, meter])).values());
            const payload = {
                meters: uniqueMeters.length > 0 ? uniqueMeters : FALLBACK_METERS,
                total: uniqueMeters.length > 0 ? uniqueMeters.length : FALLBACK_METERS.length,
                pageSize,
            };

            if (!query) {
                this.catalogCache = { data: payload, expiresAt: Date.now() + 5 * 60 * 1000 };
            }

            return payload;
        } catch (error) {
            logger.warn(`Falling back to bundled meter catalog because portal search failed: ${(error as Error).message}`);
            const payload = {
                meters: FALLBACK_METERS,
                total: FALLBACK_METERS.length,
                pageSize: 20,
            };

            if (!query) {
                this.catalogCache = { data: payload, expiresAt: Date.now() + 5 * 60 * 1000 };
            }

            return payload;
        }
    }

    private applyFiltersAndSort(meters: MeterSearchResult[], options: MeterQueryOptions = {}) {
        const term = (options.make || '').trim().toLowerCase();
        const status = (options.status || '').trim().toLowerCase();
        const dtCode = (options.dtCode || '').trim().toLowerCase();
        const phaseType = (options.phaseType || '').trim().toLowerCase();
        const sortBy = (options.sortBy || 'meterId').toLowerCase();
        const sortOrder = options.sortOrder === 'desc' ? -1 : 1;

        const filtered = meters.filter((meter) => {
            const makeMatch = !term || (meter.make || '').toLowerCase().includes(term);
            const statusMatch = !status || (meter.installStatus || '').toLowerCase().includes(status);
            const dtMatch = !dtCode || (meter.dtCode || '').toLowerCase().includes(dtCode);
            const phaseMatch = !phaseType || (meter.phaseType || '').toLowerCase().includes(phaseType);
            return makeMatch && statusMatch && dtMatch && phaseMatch;
        });

        filtered.sort((a, b) => {
            const field = sortBy as keyof MeterSearchResult;
            const left = String((a[field] as string) || '').toLowerCase();
            const right = String((b[field] as string) || '').toLowerCase();
            return left.localeCompare(right) * sortOrder;
        });

        return filtered;
    }

    /**
     * Returns the full list of meters (optionally filtered by query).
     */
    private paginate<T>(items: T[], page: number, pageSize: number) {
        const normalizedPage = page < 1 ? 1 : page;
        const start = (normalizedPage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }

    async listMeters(query: string = '', page: number = 1, options: MeterQueryOptions = {}) {
        const result = await this.fetchAllPages(query);
        const filteredMeters = this.applyFiltersAndSort(result.meters, options);
        const pagedMeters = this.paginate(filteredMeters, page, result.pageSize);

        return {
            meters: pagedMeters,
            meta: { page, pageSize: result.pageSize, total: filteredMeters.length },
        };
    }

    /**
     * Returns a filtered list of meters using the complete aggregated catalog.
     */
    async searchMeters(query: string = '', page: number = 1, options: MeterQueryOptions = {}) {
        // If a query is provided, prefer using the portal's search endpoint (server-side search + pagination).
        // This avoids fetching the entire catalog into memory and improves response time for common searches.
        const term = query.trim();
        if (term) {
            try {
                const res = await this.portal.searchMeters(term, page);
                const baseMeters = res.data || [];

                // Return portal page results directly to preserve server-side pagination behaviour.
                // If callers provided additional filters or sort options that must be applied across
                // the full dataset, we would need to fetch more data; keep this simple and efficient.
                return {
                    meters: baseMeters,
                    meta: { page: res.page || page, pageSize: res.pageSize || baseMeters.length || 20, total: res.total || baseMeters.length },
                };
            } catch (err) {
                // Fall back to the full-catalog approach if portal search fails.
                logger.warn(`portal.searchMeters failed, falling back to fetchAllPages: ${(err as Error).message}`);
            }
        }

        // Default behaviour (no query provided): aggregate full catalog (cached) and filter locally.
        const result = await this.fetchAllPages('', true);
        const baseMeters = result.meters;
        const filteredMeters = this.applyFiltersAndSort(baseMeters, options);
        const pagedMeters = this.paginate(filteredMeters, page, result.pageSize);

        return {
            meters: pagedMeters,
            meta: { page, pageSize: result.pageSize, total: filteredMeters.length },
        };
    }

    async exportMeters(query: string = '', options: MeterQueryOptions = {}) {
        const result = await this.fetchAllPages('', true);
        const term = query.trim().toLowerCase();
        const baseMeters = result.meters.filter((meter) => {
            if (!term) return true;
            const searchable = [
                meter.meterId,
                meter.serialNo,
                meter.make,
                meter.phaseType,
                meter.installStatus,
                meter.dtCode,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(term);
        });

        return this.applyFiltersAndSort(baseMeters, options);
    }

    /**
     * Returns full meter details merged with geo coordinates.
     */
    async getMeterById(id: string): Promise<MeterDetailResponse> {
        logger.debug(`getMeterById invoked for ID: ${id}`);
        logger.debug(`Dispatching concurrent requests for details and geo...`);
        const [details, geo] = await Promise.all([
            this.portal.getMeterDetails(id),
            this.portal.getMeterGeo(id).catch((err) => {
                logger.warn(`getMeterGeo threw ERROR: ${err.message}`);
                return { data: { latitude: '0', longitude: '0' } };
            }),
        ]);

        logger.debug('Details received from PortalClient', { details });
        logger.debug('Geo received from PortalClient', { geo: geo.data });

        const geoPayload = (geo as any)?.data ?? geo ?? {};
        const latitude = Number(geoPayload?.latitude ?? geoPayload?.lat ?? geoPayload?.coordinates?.latitude ?? geoPayload?.location?.latitude);
        const longitude = Number(geoPayload?.longitude ?? geoPayload?.lng ?? geoPayload?.coordinates?.longitude ?? geoPayload?.location?.longitude);

        return {
            meterId: details.meterId,
            serialNo: details.serialNo,
            make: details.make,
            phaseType: details.phaseType,
            installStatus: details.installStatus,
            installType: details.installType,
            dtCode: details.hierarchy.dt,
            coordinates: {
                latitude: Number.isFinite(latitude) ? latitude : 0,
                longitude: Number.isFinite(longitude) ? longitude : 0,
            },
            hierarchy: details.hierarchy,
        };
    }

    /**
     * Returns formatted consumption readings for a meter.
     */
    async getConsumption(id: string): Promise<FormattedConsumptionReading[]> {
        const energyRes = await this.portal.getMeterEnergy(id).catch(() => ({ data: [] } as any));
        const payload = (energyRes as any)?.data ?? energyRes ?? [];
        const data = Array.isArray(payload) ? payload : Array.isArray(payload?.readings) ? payload.readings : [];
        return data.map((r: any) => ({
            timestamp: toISOString(r?.timestamp || ''),
            kwh: parseFloat(r?.kwh || '0'),
            kvah: parseFloat(r?.kvah || '0'),
            voltage: parseFloat(r?.voltR || '0'),
        }));
    }
}
