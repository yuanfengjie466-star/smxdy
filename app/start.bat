@echo off
pushd "%~dp0"

echo === SenseNova Chat Launcher ===
echo Working directory: %CD%
echo.

echo [1/4] Checking Node.js...
node -v
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org/
    pause
    popd
    exit /b 1
)
echo.

echo [2/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        popd
        exit /b 1
    )
) else (
    echo Dependencies OK
)
echo.

echo [3/4] Building...
call npm run build
if errorlevel 1 (
    echo Build failed, starting dev mode...
    echo.
    echo [4/4] Starting dev server...
    echo Open http://localhost:3000 in browser
    call npm run dev
) else (
    echo Build OK
    echo.
    echo [4/4] Starting server...
    echo Open http://localhost:3000 in browser
    start http://localhost:3000
    set NODE_ENV=production
    node dist/boot.js
)

popd
pause
