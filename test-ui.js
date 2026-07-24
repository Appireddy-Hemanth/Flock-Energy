const API = 'http://localhost:3000/api';

async function test() {
    const id = 'J100003';
    try {
        const [detailRes, consumptionRes] = await Promise.all([
            fetch(`${API}/meters/${id}`),
            fetch(`${API}/meters/${id}/consumption`)
        ]);

        const detailJson = await detailRes.json();
        const consumptionJson = await consumptionRes.json();

        // Unwrap envelope
        const detail = detailJson.data || detailJson;
        const readings = consumptionJson.data || [];

        console.log("Detail Success:", detailJson.success);
        console.log("Consumption Success:", consumptionJson.success);

        console.log("Serial No:", detail.serialNo || detail.serialNumber || '—');
        console.log("Make:", detail.make || '—');
        console.log("Install Type:", detail.installType || '—');
    } catch (e) {
        console.error(e);
    }
}

test();
