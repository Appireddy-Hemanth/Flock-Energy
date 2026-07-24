// trace_test.ts
import { portalClient } from './src/controllers/meters';
import { MeterService } from './src/services/MeterService';
import * as fs from 'fs';

async function testTrace() {
    console.log("=== STARTING TRACE ===");
    const meterService = new MeterService(portalClient);
    try {
        const detail = await meterService.getMeterById("J100003");
        console.log("FINAL DETAIL:", JSON.stringify(detail, null, 2));
    } catch (e) {
        console.error("TRACE CAUGHT ERROR:", e);
    }
}

testTrace();
