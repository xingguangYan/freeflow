@echo off
chcp 65001 >nul
title 自由发 - 自媒体多平台分发
cd /d "%~dp0"
echo 正在启动「自由发」，浏览器会自动打开控制台 http://127.0.0.1:8917
node server.js
pause
