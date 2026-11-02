@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Instalando o TalkReady pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar o Electron. Verifique sua internet e tente novamente.
    pause
    exit /b 1
  )
)
call npm start
