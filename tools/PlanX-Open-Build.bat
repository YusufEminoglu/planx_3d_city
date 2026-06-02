@echo off
rem Drag an extracted portable-build folder onto this file to open it on a free
rem port with caching disabled. Lets you review many student builds in sequence
rem on one computer without the fixed-8080 collision.
py -3 "%~dp0PlanX-Open-Build.py" "%~1" || python "%~dp0PlanX-Open-Build.py" "%~1"
pause
