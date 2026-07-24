/**
 * Shared type definitions for the Urja Ops API Wrapper.
 * Centralised here so controllers, services, and tests can import from one place.
 */

// ─── Portal response types (upstream) ────────────────────────────

export interface MeterSearchResult {
    meterId: string;
    serialNo: string;
    make: string;
    phaseType: string;
    installStatus: string;
    dtCode: string;
}

export interface SearchResponse {
    data: MeterSearchResult[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MeterCoordinates {
    latitude: string;
    longitude: string;
}

export interface MeterGeoResponse {
    data: MeterCoordinates;
}

export interface ConsumptionReading {
    timestamp: string;
    kwh: string;
    kvah: string;
    voltR: string;
}

export interface MeterEnergyResponse {
    data: ConsumptionReading[];
}

export interface TransformerInfo {
    code: string;
    name: string;
    feederCode: string;
    capacityKva: number;
}

export interface TransformersResponse {
    data: TransformerInfo[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MeterHierarchy {
    zone: string;
    circle: string;
    division: string;
    subdivision: string;
    substation: string;
    feeder: string;
    dt: string;
}

export interface MeterDetailPayload {
    meterId: string;
    serialNo: string;
    make: string;
    phaseType: string;
    installStatus: string;
    installType: string;
    hierarchy: MeterHierarchy;
}

// ─── API response types (downstream) ────────────────────────────

export interface MeterDetailResponse {
    meterId: string;
    serialNo: string;
    make: string;
    phaseType: string;
    installStatus: string;
    installType: string;
    dtCode: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    hierarchy: MeterHierarchy;
}

export interface FormattedConsumptionReading {
    timestamp: string;
    kwh: number;
    kvah: number;
    voltage: number;
}

export interface NetworkNode {
    code: string;
    name: string;
    feederCode: string;
    capacityKva: number;
    meters: Omit<MeterSearchResult, 'dtCode'>[];
}

// ─── Custom error class ─────────────────────────────────────────

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(statusCode: number, message: string, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    static badRequest(message: string, details?: unknown): ApiError {
        return new ApiError(400, message, details);
    }

    static unauthorized(message: string, details?: unknown): ApiError {
        return new ApiError(401, message, details);
    }

    static forbidden(message: string, details?: unknown): ApiError {
        return new ApiError(403, message, details);
    }

    static notFound(message: string): ApiError {
        return new ApiError(404, message);
    }

    static portalUnavailable(message: string): ApiError {
        return new ApiError(502, message);
    }
}
