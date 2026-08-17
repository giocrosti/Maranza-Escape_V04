@echo off
rem Avvia Maranza escape: server di sviluppo + browser.
rem Uso:  doppio clic
rem
rem Il gioco resta raggiungibile solo da questo computer: il server ascolta
rem soltanto su 127.0.0.1 e non c'e' modo di aprirlo alla rete.
cd /d "%~dp0"

rem Seconda invocazione di se stesso: aspetta che il server sia in piedi,
rem poi apre il browser. Serve perche' la riga del server non restituisce
rem il controllo finche' il server e' acceso.
if /i "%~1"=="--browser" goto apri_browser

set PORTA=5173

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js non trovato.
  echo  Scaricalo da https://nodejs.org/ ^(versione LTS^), poi riprova.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Prima volta: installo quello che serve. Ci vuole un minuto.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  L'installazione non e' riuscita.
    echo.
    pause
    exit /b 1
  )
)

rem Se la porta risponde gia', il server e' acceso: apro solo il browser.
netstat -ano | findstr /c:":%PORTA% " | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo  Il server era gia' acceso sulla porta %PORTA%: apro il gioco.
  echo.
  start "" "http://127.0.0.1:%PORTA%/"
  exit /b 0
)

echo.
echo  MARANZA ESCAPE
echo.
echo  Server in avvio su http://127.0.0.1:%PORTA%/
echo  Tra qualche secondo si aprira' il browser.
echo  Per chiudere, chiudi questa finestra.
echo.

start "" /b cmd /c ""%~f0" --browser"
call npm run dev

rem Si arriva qui solo quando il server si ferma o non parte.
echo.
echo  Server fermato.
pause
exit /b 0

:apri_browser
rem Qualche secondo di attesa: Vite ci mette un attimo al primo avvio, perche'
rem deve preparare le dipendenze. Si usa ping e non timeout perche' timeout
rem fallisce quando l'input standard e' rediretto, e stampa un errore per nulla.
ping -n 6 127.0.0.1 >nul
start "" "http://127.0.0.1:5173/"
exit /b 0
