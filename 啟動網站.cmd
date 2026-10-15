@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js，請先安裝 Node.js。
  pause
  exit /b 1
)
echo 啟動後請開啟 http://127.0.0.1:4173/
echo 在網站直接點作品或履歷即可編輯。
echo 使用期間保留這個視窗；關閉視窗即可停止網站。
node server.cjs
pause
