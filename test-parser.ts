import * as path from 'path';
import * as fs from 'fs';

const payload = { "type": "data", "nodes": [{ "type": "skip" }, { "type": "skip" }, { "type": "data", "data": [{ "meterId": 1, "detail": 2, "hierarchy": 21 }, "J100008", { "data": 3 }, [4, 6, 9, 12, 15, 18], { "parameterName": 5, "parameterValue": 1 }, "Meter ID", { "parameterName": 7, "parameterValue": 8 }, "Serial No", "SE63900", { "parameterName": 10, "parameterValue": 11 }, "Make", "Genus", { "parameterName": 13, "parameterValue": 14 }, "Phase Type", "single", { "parameterName": 16, "parameterValue": 17 }, "Installation Status", "Installed", { "parameterName": 19, "parameterValue": 20 }, "Installation Type", "Whole Current", { "Meter ID": 1, "Installation Status": 17, "Installation Type": 20, "Zone": 22, "Circle": 23, "Division": 24, "Subdivision": 25, "Sub Station": 26, "Feeder": 27, "DT": 28 }, "Jaipur Zone 3 (Z-03)", "Circle 3 (C-03)", "Division 9 (D-09)", "Subdivision 9 (SD-09)", "Substation 9 (SS-09)", "Feeder 9 (F-009)", "Sikar Road DT 9 (DT-009)"], "uses": { "params": ["id"] } }] };

function parseSvelteKitData(jsonObj: any): any {
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

const parsed = parseSvelteKitData(payload);
console.log(JSON.stringify(parsed, null, 2));

const paramList = parsed.detail?.data || [];
const paramMap: Record<string, string> = {};
for (const item of paramList) {
    if (item && typeof item === 'object' && item.parameterName && item.parameterValue !== undefined) {
        paramMap[item.parameterName] = String(item.parameterValue);
    }
}
console.log(paramMap);
