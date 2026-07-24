/**
 * Consistent API response envelope helpers.
 * All API responses follow { success, data, meta? } shape.
 */

export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: PaginationMeta;
}

export function successResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
    const response: ApiResponse<T> = { success: true, data };
    if (meta) response.meta = meta;
    return response;
}

export function errorResponse(message: string, details?: unknown) {
    const response: Record<string, unknown> = { success: false, error: message };
    if (details) response.details = details;
    return response;
}
