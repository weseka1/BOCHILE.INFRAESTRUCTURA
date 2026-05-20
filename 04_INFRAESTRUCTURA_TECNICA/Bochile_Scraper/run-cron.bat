@echo off
REM Bochile Scraper - Cron diario
REM Ejecuta el scrape incremental y sube al Sheet.
REM Para programar en Windows Task Scheduler:
REM   1. Abrir Task Scheduler (taskschd.msc)
REM   2. Create Basic Task → Nombre "Bochile Scraper Diario"
REM   3. Trigger: Daily, 06:00
REM   4. Action: Start a program → Browse → este .bat
REM   5. Finish

setlocal
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

set LOG_DIR=%SCRIPT_DIR%output\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set LOG_FILE=%LOG_DIR%\scraper-%date:~6,4%%date:~3,2%%date:~0,2%.log

echo. >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"
echo Bochile Scraper - inicio %date% %time% >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

REM Modo incremental: solo propiedades modificadas desde ayer
for /f %%a in ('powershell -Command "(Get-Date).AddDays(-1).ToString('yyyy-MM-dd')"') do set YESTERDAY=%%a

call npm run scrape -- --since %YESTERDAY% --to-sheet >> "%LOG_FILE%" 2>&1
set RET=%errorlevel%

echo. >> "%LOG_FILE%"
echo Bochile Scraper - fin %date% %time% (exit code %RET%) >> "%LOG_FILE%"

REM Pipeline RAG: enrich (LLM) → upload Sheet enriquecido → re-embed Qdrant
echo. >> "%LOG_FILE%"
echo --- Bochile RAG: enrich + upload-sheet + embed --- >> "%LOG_FILE%"
cd /d "%SCRIPT_DIR%..\Bochile_RAG"
call npm run enrich >> "%LOG_FILE%" 2>&1
call npm run upload-sheet >> "%LOG_FILE%" 2>&1
call npm run embed >> "%LOG_FILE%" 2>&1
echo Bochile RAG fin %date% %time% (exit code %errorlevel%) >> "%LOG_FILE%"

exit /b %RET%
