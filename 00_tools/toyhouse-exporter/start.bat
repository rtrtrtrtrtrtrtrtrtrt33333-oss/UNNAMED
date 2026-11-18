@echo off
cd /d "%~dp0"
python exporter.py
if errorlevel 1 pause
