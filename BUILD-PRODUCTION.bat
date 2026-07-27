@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo ERROR: The .env file is missing.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 pause & exit /b 1
call npm run build
if errorlevel 1 pause & exit /b 1
echo.
echo Production build completed in the dist folder.
pause
