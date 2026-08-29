@echo off
cd C:\Users\Broken Crown\Music\THERMA
node server.js > NUL 2>&1
timeout /t 3 > NUL
echo.
echo=== Testing Zoe endpoint ===
curl -s -X POST http://localhost:3000/api/zoe -H "Content-Type: application/json" -d "{\"message\":\"Which area is hottest?\",\"context\":{\"location\":{\"id\":\"miami-downtown\",\"display\":\"Downtown Miami\"},\"screen\":\"heat\"}}"
echo.
echo=== Test 2 ===
curl -s -X POST http://localhost:3000/api/zoe -H "Content-Type: application/json" -d "{\"message\":\"Open Heat Intelligence\",\"context\":{\"location\":{\"id\":\"miami-downtown\",\"display\":\"Downtown Miami\"},\"screen\":\"heat\"}}"
echo.
echo=== Test 3 ===
curl -s -X POST http://localhost:3000/api/zoe -H "Content-Type: application/json" -d "{\"message\":\"Show alerts\",\"context\":{\"location\":{\"id\":\"miami-downtown\",\"display\":\"Downtown Miami\"},\"screen\":\"heat\"}}"
echo.
echo=== Test 4 ===
curl -s -X POST http://localhost:3000/api/zoe -H "Content-Type: application/json" -d "{\"message\":\"Switch to persistence layer\",\"context\":{\"location\":{\"id\":\"miami-downtown\",\"display\":\"Downtown Miami\"},\"screen\":\"heat\"}}"
echo.
echo=== Test 5 ===
curl -s -X POST http://localhost:3000/api/zoe -H "Content-Type: application/json" -d "{\"message\":\"Generate a report\",\"context\":{\"location\":{\"id\":\"miami-downtown\",\"display\":\"Downtown Miami\"},\"screen\":\"heat\"}}"