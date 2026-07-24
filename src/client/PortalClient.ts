import https from 'https';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/environment';
import { ApiError } from '../types';
import { logger } from '../utils/logger';
import {
    SearchResponse,
    MeterDetailPayload,
    MeterGeoResponse,
    MeterEnergyResponse,
    TransformersResponse,
} from '../types';

/**
 * HTTP client for the legacy Urja Ops portal.
 * Handles authentication, session cookie management, and SvelteKit devalue parsing.
 */
export class PortalClient {
    private client: AxiosInstance;
    private sessionCookie: string | null = null;
    private authenticated: boolean = false;

    constructor() {
        this.client = axios.create({
            baseURL: env.portalBaseUrl,
            timeout: 15_000,
            validateStatus: () => true,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
    }

    /** Whether the client currently holds a valid session. */
    public isAuthenticated(): boolean {
        return this.authenticated && this.sessionCookie !== null;
    }

    /**
     * Performs SvelteKit form-action login to retrieve a session cookie.
     */
    public async login(): Promise<void> {
        logger.info('Portal request', { method: 'POST', url: '/login' });
        const payload = `email=${encodeURIComponent(env.portalEmail)}&password=${encodeURIComponent(env.portalPassword)}`;

        const response = await this.client.post('/login', payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'x-sveltekit-action': 'true',
                'Origin': env.portalBaseUrl,
                'Referer': `${env.portalBaseUrl}/login`,
                'User-Agent': 'Mozilla/5.0',
            },
        });

        if (response.status !== 200) {
            throw ApiError.unauthorized('Authentication failed', {
                status: response.status,
                body: response.data,
            });
        }

        const setCookies = response.headers['set-cookie'];
        if (!setCookies || setCookies.length === 0) {
            throw ApiError.unauthorized('Authentication failed', 'Portal authenticated but returned no session cookies.');
        }

        this.sessionCookie = setCookies.map((c) => c.split(';')[0]).join('; ');
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
        this.authenticated = true;
    }

    /**
     * Wraps requests with automatic authentication and session renewal.
     */
    private async executeRequest<T>(reqFn: () => Promise<any>, attempt = 1): Promise<T> {
        logger.debug('Portal request started');
        if (!this.authenticated || !this.sessionCookie) {
            logger.debug('No active portal session; logging in');
            await this.login();
        }

        logger.debug('Executing portal request');
        let response;
        try {
            response = await reqFn();
            logger.info('Portal response', { status: response.status });
        } catch (e: any) {
            logger.error('Portal request failed', { message: e.message });
            if (attempt < 3) {
                logger.warn('Retrying portal request', { attempt });
                return this.executeRequest(reqFn, attempt + 1);
            }
            throw ApiError.portalUnavailable('Portal unavailable');
        }

        // Auto-renew on session expiry
        if (
            response.status === 401 ||
            response.status === 403 ||
            (response.status === 302 && response.headers['location'] === '/login')
        ) {
            logger.warn('Portal session expired or rejected', { status: response.status });
            this.authenticated = false;
            this.sessionCookie = null;
            await this.login();
            response = await reqFn();
            logger.info('Portal retry response', { status: response.status });
        }

        if (response.status === 401 || response.status === 403) {
            throw ApiError.forbidden('Session expired', {
                status: response.status,
                body: response.data,
            });
        }

        if (response.status === 404) {
            throw ApiError.notFound('Meter not found');
        }

        if (response.status !== 200) {
            if (attempt < 3) {
                logger.warn('Portal request returned transient error; retrying', { status: response.status, attempt });
                return this.executeRequest(reqFn, attempt + 1);
            }
            logger.error('Portal rejection', { status: response.status, body: response.data });
            throw ApiError.portalUnavailable('Portal unavailable');
        }

        return response.data as T;
    }

    /** Search / list meters with optional query and pagination. */
    public async searchMeters(q: string = '', page: number = 1): Promise<SearchResponse> {
        logger.info('Portal request', { method: 'GET', url: '/portal/meters/search', query: q, page });
        return this.executeRequest<SearchResponse>(() =>
            this.client.get('/portal/meters/search', {
                params: { q, page },
                headers: { 'User-Agent': 'Mozilla/5.0' },
            })
        );
    }

    /** Fetch full meter details via SvelteKit __data.json endpoint. */
    public async getMeterDetails(id: string): Promise<MeterDetailPayload> {
        logger.info('Portal request', { method: 'GET', url: `/meters/${id}/__data.json` });
        const data = await this.executeRequest<any>(() => {
            return this.client.get(`/meters/${encodeURIComponent(id)}/__data.json`, {
                params: { 'x-sveltekit-invalidated': '001' },
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
        });

        const parsed = this.parseSvelteKitData(data);
        if (!parsed) {
            logger.error('Parser failed for meter detail payload', { meterId: id });
            throw new Error(`Failed to parse SvelteKit data for meter ${id}`);
        }

        const paramList = parsed.detail?.data || [];
        const paramMap: Record<string, string> = {};
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
        for (const item of paramList) {
            if (item && typeof item === 'object' && item.parameterName && item.parameterValue !== undefined) {
                const key = String(item.parameterName);
                paramMap[key] = String(item.parameterValue);
                paramMap[normalize(key)] = String(item.parameterValue);
            }
        }

        const hierarchy = parsed.hierarchy || {};
        const getParam = (...names: string[]) => {
            for (const name of names) {
                const direct = paramMap[name];
                if (direct !== undefined) return direct;
                const normalized = paramMap[normalize(name)];
                if (normalized !== undefined) return normalized;
            }
            return 'N/A';
        };

        logger.debug('Parser output', { meterId: id, hierarchy });

        return {
            meterId: id,
            serialNo: getParam('Serial No', 'Serial Number', 'Serial'),
            make: getParam('Make'),
            phaseType: getParam('Phase Type'),
            installStatus: getParam('Installation Status', 'Install Status'),
            installType: getParam('Installation Type', 'Install Type'),
            hierarchy: {
                zone: hierarchy['Zone'] || hierarchy['zone'] || 'N/A',
                circle: hierarchy['Circle'] || hierarchy['circle'] || 'N/A',
                division: hierarchy['Division'] || hierarchy['division'] || 'N/A',
                subdivision: hierarchy['Subdivision'] || hierarchy['subdivision'] || 'N/A',
                substation: hierarchy['Sub Station'] || hierarchy['Substation'] || hierarchy['substation'] || 'N/A',
                feeder: hierarchy['Feeder'] || hierarchy['feeder'] || 'N/A',
                dt: hierarchy['DT'] || hierarchy['dt'] || 'N/A',
            },
        };
    }

    /** Fetch geo coordinates for a meter. */
    public async getMeterGeo(id: string): Promise<MeterGeoResponse> {
        logger.info('Portal request', { method: 'GET', url: `/portal/meters/${id}/geo` });
        const payload = await this.executeRequest<any>(() =>
            this.client.get(`/portal/meters/${encodeURIComponent(id)}/geo`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            })
        );

        const source = payload?.data ?? payload ?? {};
        const coordinates = source.coordinates ?? source.location ?? source.geo ?? {};
        const latitude = source.latitude ?? coordinates.latitude ?? source.lat ?? source.y;
        const longitude = source.longitude ?? coordinates.longitude ?? source.lng ?? source.x;

        return {
            data: {
                latitude: latitude != null ? String(latitude) : '0',
                longitude: longitude != null ? String(longitude) : '0',
            },
        };
    }

    /** Fetch historic energy consumption readings for a meter. */
    public async getMeterEnergy(id: string): Promise<MeterEnergyResponse> {
        logger.info('Portal request', { method: 'GET', url: `/portal/meters/${id}/energy` });
        const payload = await this.executeRequest<any>(() =>
            this.client.get(`/portal/meters/${encodeURIComponent(id)}/energy`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            })
        );

        const source = payload?.data ?? payload ?? {};
        const readings = Array.isArray(source) ? source : Array.isArray(source.readings) ? source.readings : [];

        return { data: readings };
    }

    /** Fetch paginated list of distribution transformers. */
    public async getTransformers(page: number = 1): Promise<TransformersResponse> {
        logger.info('Portal request', { method: 'GET', url: '/portal/dts', page });
        return this.executeRequest<TransformersResponse>(() =>
            this.client.get('/portal/dts', {
                params: { page },
                headers: { 'User-Agent': 'Mozilla/5.0' },
            })
        );
    }

    /**
     * Decodes SvelteKit's devalue serialization format into standard objects.
     */
    private parseSvelteKitData(jsonObj: any): any {
        const nodes = jsonObj.nodes;
        if (!nodes?.length) return null;

        const nodeWithData = nodes.find((n: any) => n?.type === 'data');
        if (!nodeWithData?.data) return null;

        const rawArray = nodeWithData.data;
        const root = rawArray[0];
        const resolved = new Map<number, any>();

        const resolveValue = (val: any): any => {
            if (typeof val === 'number' && val >= 0 && val < rawArray.length) {
                if (resolved.has(val)) return resolved.get(val);
                resolved.set(val, `Cycle:${val}`);
                const realVal = resolveValue(rawArray[val]);
                resolved.set(val, realVal);
                return realVal;
            }
            if (Array.isArray(val)) {
                return val.map((item) => resolveValue(item));
            }
            if (val && typeof val === 'object') {
                const obj: any = {};
                for (const key of Object.keys(val)) {
                    obj[key] = resolveValue(val[key]);
                }
                return obj;
            }
            return val;
        };

        return resolveValue(root);
    }
}
