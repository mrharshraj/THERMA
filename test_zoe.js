const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/zoe',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

function sendZoe(message, context) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify({ message, context }));
        req.end();
    });
}

async function test(message, context) {
    try {
        const result = await sendZoe(message, context);
        console.log(`MESSAGE: "${message}"`);
        console.log(`RESULT:`, JSON.stringify(result, null, 2));
        console.log('---');
        return result;
    } catch (e) {
        console.log(`MESSAGE: "${message}"`);
        console.log(`ERROR:`, e.message);
        console.log('---');
        return { error: e.message };
    }
}

// Test 1: Hottest area
test("Which area is hottest?", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 2: Open Heat Intelligence
test("Open Heat Intelligence", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 3: Open Environment
test("Show environmental conditions", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 4: Open CoolRoute
test("Open CoolRoute", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 5: Show alerts
test("Show alerts", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 6: Generate report
test("Generate a report", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 7: Switch to persistence layer
test("Switch to persistence layer", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 8: Which route is coolest
test("Find the coolest route", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 9: Explain this thermal layer
test("Explain this thermal layer", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });

// Test 10: Best time to go outside
test("When should I go outside", { location: { id: 'miami-downtown', display: 'Downtown Miami' }, screen: 'heat' });