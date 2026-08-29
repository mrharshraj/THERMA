const { buildReport } = require('./backend/services/reports.js');

// Test 1: Minimal valid context (only location.display)
console.log('=== TEST 1: Minimal context with location.display ===');
try {
  const ctx1 = {
    location: { display: 'Test Location' }
  };
  const result = buildReport(ctx1);
  console.log('PASS: buildReport succeeded');
  console.log('  id:', result.id);
  console.log('  meta:', JSON.stringify(result.meta));
  console.log('  html length:', result.html?.length);
} catch (e) {
  console.log('FAIL: buildReport threw');
  console.log('  error:', e.message);
  console.log('  stack:', e.stack);
}

// Test 2: Context with heatmap data
console.log('\n=== TEST 2: Context with heatmap ===');
try {
  const ctx2 = {
    location: { display: 'Test Location' },
    heatmap: {
      stats: { mean: 25.5, min: 20, max: 30 },
      current: { humidity: 60, heatIndexC: 28 }
    }
  };
  const result = buildReport(ctx2);
  console.log('PASS: buildReport succeeded');
  console.log('  id:', result.id);
} catch (e) {
  console.log('FAIL: buildReport threw');
  console.log('  error:', e.message);
}

// Test 3: Context with full shape like what Zoe sends
console.log('\n=== TEST 3: Context similar to Zoe generate_report ===');
try {
  const ctx3 = {
    location: { display: 'Miami, FL' },
    heatmap: {
      stats: { mean: 27, min: 22, max: 32 },
      hourly: [{ hour: 14, value: 30 }]
    },
    environment: {
      current: { temperature: 28, humidity: 65, windSpeed: 5 }
    },
    exposure: { score: 75, level: 'High' }
  };
  const result = buildReport(ctx3);
  console.log('PASS: buildReport succeeded');
  console.log('  id:', result.id);
} catch (e) {
  console.log('FAIL: buildReport threw');
  console.log('  error:', e.message);
  console.log('  stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
}