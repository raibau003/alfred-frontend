@echo off
REM Alfred PC Bridge — Instalador para Windows
REM Uso: install-windows.bat TU_TOKEN

setlocal

set TOKEN=%1
if "%TOKEN%"=="" (
    echo Error: Debes proporcionar tu token
    echo Uso: install-windows.bat TU_TOKEN
    exit /b 1
)

set INSTALL_DIR=%USERPROFILE%\.alfred-bridge

echo Instalando Alfred PC Bridge...

REM Create directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Download bridge script
powershell -Command "Invoke-WebRequest -Uri 'https://alfred-frontend-vercel.vercel.app/alfred-bridge.py' -OutFile '%INSTALL_DIR%\alfred-bridge.py'"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python no esta instalado. Instalando Python...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe' -OutFile '%TEMP%\python-installer.exe'"
    "%TEMP%\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1
    echo Python instalado. Reinicia la terminal y ejecuta de nuevo.
    pause
    exit /b 0
)

REM Install dependencies
echo Instalando dependencias...
pip install playwright websockets
python -m playwright install chromium

REM Save token
echo %TOKEN% > "%INSTALL_DIR%\.token"

REM Create startup script
echo @echo off > "%INSTALL_DIR%\run.bat"
echo cd "%INSTALL_DIR%" >> "%INSTALL_DIR%\run.bat"
echo set /p TOKEN=^<.token >> "%INSTALL_DIR%\run.bat"
echo python alfred-bridge.py --token %%TOKEN%% >> "%INSTALL_DIR%\run.bat"

REM Add to Windows startup
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy "%INSTALL_DIR%\run.bat" "%STARTUP%\alfred-bridge.bat" >nul

REM Start now
start "" "%INSTALL_DIR%\run.bat"

echo.
echo Alfred PC Bridge instalado!
echo Se ejecuta automaticamente al iniciar Windows.
echo Token: %TOKEN%
echo.
echo Para desinstalar: elimina %INSTALL_DIR% y %STARTUP%\alfred-bridge.bat
pause
