@echo off
rem Runs the app locally on Windows: checks Node, installs pnpm and packages when missing, starts the dev server.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [dev] Node.js is not installed. Install Node.js 24 LTS from https://nodejs.org/ and run this file again.
  start "" "https://nodejs.org/"
  goto :fail
)

set /p WANT_NODE=<.nvmrc
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set HAVE_NODE=%%v
if not "%HAVE_NODE%"=="%WANT_NODE%" (
  echo [dev] Warning: Node.js %WANT_NODE% is required, but %HAVE_NODE% is active.
)

call pnpm --version >nul 2>nul
if errorlevel 1 (
  echo [dev] pnpm is not installed. Installing it with npm...
  call npm install -g pnpm@12.16.0
  if errorlevel 1 goto :fail
  call pnpm --version >nul 2>nul
  if errorlevel 1 (
    echo [dev] pnpm was installed but is not on PATH yet. Open a new terminal and run this file again.
    goto :fail
  )
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [dev] Created .env from .env.example
)

if not exist "node_modules" (
  echo [dev] Installing packages...
  call pnpm install
  if errorlevel 1 goto :fail
)

echo [dev] Starting http://localhost:3000 (design system: http://localhost:3000/design-system). Stop with Ctrl+C.
call pnpm dev
goto :eof

:fail
echo.
pause
exit /b 1
