@echo off
setlocal
echo ========================================================
echo  SwiftTransit Java Backend Startup Script
echo ========================================================

REM Navigate to backend folder
cd /d "%~dp0"

echo Compiling Java source files...
if not exist "bin" mkdir "bin"

javac -d bin src\main\java\com\swifttransit\model\*.java src\main\java\com\swifttransit\storage\*.java src\main\java\com\swifttransit\service\*.java src\main\java\com\swifttransit\server\*.java src\main\java\com\swifttransit\*.java

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Compilation failed. Please ensure JDK 17+ is installed and on your PATH.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Starting SwiftTransit Java Server on http://localhost:8080 ...
java -cp bin com.swifttransit.Main %*

endlocal
