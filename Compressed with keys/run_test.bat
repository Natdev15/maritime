@echo off
echo Cleaning database files...

REM Delete database files (.db, .wal, .shm, .journal, etc.)
if exist *.db (
    del /f /q *.db
    echo Deleted .db files
)
if exist *.wal (
    del /f /q *.wal
    echo Deleted .wal files
)
if exist *.shm (
    del /f /q *.shm
    echo Deleted .shm files
)
if exist *.journal (
    del /f /q *.journal
    echo Deleted .journal files
)
if exist *.sqlite (
    del /f /q *.sqlite
    echo Deleted .sqlite files
)
if exist *.sqlite3 (
    del /f /q *.sqlite3
    echo Deleted .sqlite3 files
)

echo Database files cleaned.
echo.

echo Starting npm start...
start "npm start" cmd /k "npm start"

echo Waiting 5 seconds for server to start...
timeout /t 5 /nobreak >nul

echo Starting test load...
start "test-load" cmd /k "node test-load.js individual --total=100 --records=100 --rate=10000"

echo.
echo Both processes started in separate windows.
echo Press any key to exit...
pause >nul 