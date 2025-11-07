@echo off
chcp 65001 >NUL
REM ===== config.bat =====
REM Benutzer/Hosts
set "VMDB_USER=jan"
set "VMDB_HOST=192.168.56.11"
set "VMDB_PORT="            REM bei NAT z.B. 2222
set "VMAPP_USER=jan"
set "VMAPP_HOST=192.168.56.12"
set "VMAPP_PORT="           REM bei NAT z.B. 2223

REM SSH-Key-Pfad
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"

REM Remote-Verzeichnisse
set "DB_DIR=/opt/rsd/db"
set "APP_DIR=/opt/rsd/js"

REM URL, die im Browser geoeffnet wird
set "APP_URL=http://192.168.56.12:7777"

