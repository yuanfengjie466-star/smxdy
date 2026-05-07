@echo off
echo === STARTING ===
echo Current directory: %CD%
echo.
echo Checking Node.js...
node -v
npm -v
echo.
echo Checking node_modules...
if not exist "node_modules" (
    echo node_modules NOT FOUND
) else (
    echo node_modules found
)
echo.
echo Build test...
call npm run build 2>&1
echo.
echo DONE
pause