@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm，请先安装 Node.js。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次启动，正在安装依赖...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm run start:game
pause

