@echo off
cd /d "%~dp0"
echo.
echo ==============================================
echo   Valid Tree Service CRM - Setup and Start
echo ==============================================
echo.
if not exist ".env" (
  echo ERROR: The .env file is missing.
  echo Copy your existing .env file into this folder first.
  echo See START-HERE.md for details.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js and npm were not found.
  echo Install the current Node.js LTS version, then run this file again.
  echo.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing project packages...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Review the error above.
    pause
    exit /b 1
  )
)
echo.
echo Starting the CRM...
call npm run dev
pause
