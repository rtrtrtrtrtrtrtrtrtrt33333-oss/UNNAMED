@echo off
cd /d "%~dp0"
python updater.py
if errorlevel 1 pause
