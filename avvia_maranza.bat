@echo off
rem Avvia Maranza escape: server locale + browser.
rem Uso:  doppio clic
rem       avvia_maranza.bat 8790     per usare un'altra porta
rem
rem Il gioco resta raggiungibile solo da questo computer: il server ascolta
rem soltanto su 127.0.0.1 e non c'e' modo di aprirlo alla rete.
cd /d "%~dp0"

rem Seconda invocazione di se stesso: aspetta che il server sia in piedi,
rem poi apre il browser. Serve perche' la riga del server non restituisce
rem il controllo finche' il server e' acceso.
if /i "%~1"=="--browser" goto apri_browser

set PORTA=%~1
if "%PORTA%"=="" set PORTA=8775

if not exist "dev-server.py" (
  echo.
  echo  Non trovo dev-server.py in questa cartella:
  echo  %CD%
  echo  Il file .bat deve stare accanto al gioco.
  echo.
  pause
  exit /b 1
)

rem Serve Python: prima "python", poi il lanciatore "py"
set PYTHON=
where python >nul 2>nul && set PYTHON=python
if not defined PYTHON where py >nul 2>nul && set PYTHON=py
if not defined PYTHON (
  echo.
  echo  Python non trovato.
  echo  Scaricalo da https://www.python.org/downloads/ e durante
  echo  l'installazione spunta "Add Python to PATH", poi riprova.
  echo.
  pause
  exit /b 1
)

rem Se la porta risponde gia', il server e' acceso: apro solo il browser.
netstat -ano | findstr /c:":%PORTA% " | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo  Il server era gia' acceso sulla porta %PORTA%: apro il gioco.
  echo.
  start "" "http://localhost:%PORTA%/"
  exit /b 0
)

echo.
echo  MARANZA ESCAPE
echo.
echo  Server in avvio su http://localhost:%PORTA%/
echo  Tra qualche secondo si aprira' il browser.
echo  Per chiudere, chiudi questa finestra.
echo.

start "" /b cmd /c ""%~f0" --browser %PORTA%"
%PYTHON% dev-server.py %PORTA%

rem Si arriva qui solo quando il server si ferma o non parte.
echo.
echo  Server fermato.
pause
exit /b 0

:apri_browser
set PORTA=%~2
if "%PORTA%"=="" set PORTA=8775
rem Due secondi di attesa. Si usa ping e non timeout perche' timeout fallisce
rem quando l'input standard e' rediretto, e stampa un errore per nulla.
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:%PORTA%/"
exit /b 0
