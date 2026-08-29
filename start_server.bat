@echo off
cd C:\Users\Broken Crown\Music\THERMA
node server.js > NUL 2>&1
timeout /t 5 > NUL
echo Server started.