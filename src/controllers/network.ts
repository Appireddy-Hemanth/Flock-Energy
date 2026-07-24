import { Request, Response, NextFunction } from 'express';
import { NetworkService } from '../services/NetworkService';
import { portalClient } from './meters';
import { successResponse } from '../utils/response';

const networkService = new NetworkService(portalClient);

export class NetworkController {

    /**
     * GET /network
     * Returns hierarchical tree of DTs (transformers) and their installed meters.
     */
    public static async getNetworkLayout(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tree = await networkService.getNetworkTree();
            res.json(successResponse(tree));
        } catch (error) {
            next(error);
        }
    }
}
