@echo off
chcp 65001 >NUL
setlocal EnableExtensions EnableDelayedExpansion
REM ===== start_app.bat =====

REM 1) Config laden (muss neben der Batch liegen)
if not exist "%~dp0config.bat" (
  echo [FEHLER] Config "%~dp0config.bat" nicht gefunden.
  pause & exit /b 1
)
call "%~dp0config.bat"

REM 2) SSH-Optionen zentral
set "SSH_OPTS=-o BatchMode=yes -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -i \"%SSH_KEY%\""

REM 3) optionale Port-Flags bauen
set "PORTOPT_DB="
if defined VMDB_PORT set "PORTOPT_DB=-p %VMDB_PORT%"
set "PORTOPT_APP="
if defined VMAPP_PORT set "PORTOPT_APP=-p %VMAPP_PORT%"

REM ====== VMs sicher headless starten ======
set "VBOX=%ProgramFiles%\Oracle\VirtualBox\VBoxManage.exe"
set "VM_DB=VM-DB"
set "VM_APP=VM-App"

if not exist "%VBOX%" (
  echo [FEHLER] VBoxManage nicht gefunden: %VBOX%
  pause & exit /b 1
)

call :ensure_running "%VM_DB%"
call :ensure_running "%VM_APP%"

REM Warten bis SSH erreichbar (Host-Only-IPs/Ports ggf. anpassen)
call :wait_ssh 192.168.56.11 22 20
call :wait_ssh 192.168.56.12 22 20

echo [1/3] Starte DB auf %VMDB_HOST% ...
ssh %SSH_OPTS% %PORTOPT_DB% %VMDB_USER%@%VMDB_HOST% "cd %DB_DIR% && docker compose up -d" || (
  echo [FEHLER] Start DB-Stack fehlgeschlagen.
  pause & exit /b 1
)

echo [2/3] Starte App auf %VMAPP_HOST% ...
ssh %SSH_OPTS% %PORTOPT_APP% %VMAPP_USER%@%VMAPP_HOST% "cd %APP_DIR% && docker compose up -d" || (
  echo [FEHLER] Start App-Stack fehlgeschlagen.
  pause & exit /b 1
)

echo [3/3] Warte auf %APP_URL% ...
for /L %%i in (1,1,30) do (
  curl -s --max-time 2 "%APP_URL%" >NUL 2>&1
  if not errorlevel 1 goto :open
  echo  - Versuch %%i/30 ...
  timeout /t 2 >NUL
)
echo [WARNUNG] Konnte das Dashboard nicht erreichen. Oeffne trotzdem den Browser.

:open
start "" "%APP_URL%"
pause
exit /b 0


:ensure_running
REM %~1 = VM-Name. Robust pruefen via 'list runningvms'.
set "VMNAME=%~1"
"%VBOX%" list runningvms | findstr /I /C:"\"%VMNAME%\"" >NUL
if errorlevel 1 (
  echo Starte %VMNAME% headless ...
  "%VBOX%" startvm "%VMNAME%" --type headless
) else (
  echo %VMNAME% laeuft bereits.
)
exit /b 0


:wait_ssh
REM %1=host %2=port %3=maxVersuche
set "HOST=%~1" & set "PORT=%~2" & set "TRIES=%~3"
for /L %%i in (1,1,%TRIES%) do (
  powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('%HOST%', %PORT%) ; exit 0 } catch { exit 1 }"
  if not errorlevel 1 exit /b 0
  echo  - warte auf SSH %HOST%:%PORT% (%%i/%TRIES%) ...
  timeout /t 2 >NUL
)
echo [WARNUNG] SSH %HOST%:%PORT% nicht erreichbar.
exit /b 0

