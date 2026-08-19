@echo off
set FORENSYNC_JWT_SECRET=test-jwt-secret-12345
set FORENSYNC_REFRESH_SECRET=test-refresh-secret-67890
set FORENSYNC_PORT=8001
cd /d "C:\Users\himanshu\Downloads\projects\kanad_shield\api"
python main.py
