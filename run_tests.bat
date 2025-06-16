@echo off
setlocal enabledelayedexpansion

echo Starting test automation for maritime-serializer...
echo.

REM Define the folders to process
set "folders=Compressed with keys;Compressed without keys;normal db"

REM Get the current directory to return to later
set "ORIGINAL_DIR=%CD%"

REM Loop through each folder
for %%f in ("%folders:;=" "%") do (
    set "folder=%%~f"
    echo Processing folder: !folder!
    echo ================================
    
    REM Change to the folder
    if exist "!folder!" (
        echo Changing to directory: !folder!
        cd /d "!folder!"
        echo Current directory: %CD%
        
        echo Cleaning database files in !folder!...
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
        
        echo Starting npm start for !folder!...
        REM Store current directory in a variable to avoid issues with spaces
        set "CURRENT_FOLDER=%CD%"
        REM Start npm start in a new command window - properly quote the path
        start "npm start - !folder!" cmd /k "cd /d "!CURRENT_FOLDER!" && npm start"
        
        echo Waiting 5 seconds for server to start...
        timeout /t 5 /nobreak >nul
        
        echo Starting test load for !folder!...
        REM Start test-load in another new command window - properly quote the path
        start "test-load - !folder!" cmd /k "cd /d "!CURRENT_FOLDER!" && node test-load.js individual --total=100 --records=100 --rate=10000"
        
        echo.
        echo !folder! processes started. Check the opened command windows.
        echo Press any key to continue to next folder...
        pause >nul
        echo.
        
        REM Go back to the original directory
        cd /d "%ORIGINAL_DIR%"
    ) else (
        echo ERROR: Folder "!folder!" not found!
        echo.
    )
)

echo.
echo All folders processed!
echo Check the opened command windows for each folder's npm start and test-load processes.
echo.
echo Press any key to exit...
pause >nul 