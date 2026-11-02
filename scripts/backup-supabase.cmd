@echo off
setlocal EnableExtensions

set "EXPECTED_PROJECT_REF=sbphfvdzvatgxanwhbmt"

where pg_dump >nul 2>nul
if errorlevel 1 (
  echo ERRO: pg_dump nao foi encontrado no PATH.
  echo Instale as ferramentas de linha de comando do PostgreSQL e abra um novo terminal.
  echo O Docker nao e necessario para este script.
  goto :failure
)

where pg_restore >nul 2>nul
if errorlevel 1 (
  echo ERRO: pg_restore nao foi encontrado no PATH.
  echo Instale as ferramentas de linha de comando do PostgreSQL e abra um novo terminal.
  goto :failure
)

echo.
echo Backup logico dos schemas public e supabase_migrations.
echo Este script roda localmente e nao apaga nem altera dados no Supabase.
echo Nao inclui os schemas gerenciados auth/storage nem arquivos do Storage.
echo.
echo No Supabase Dashboard, abra Connect e copie os dados da conexao PostgreSQL.
echo Para pooler, prefira o modo Session. O usuario deve identificar o projeto.
echo A senha sera solicitada pelo pg_dump e nao deve ser colada nos campos abaixo.
echo.

set /p "DB_HOST=Host PostgreSQL: "
if not defined DB_HOST (
  echo ERRO: o host e obrigatorio.
  goto :failure
)

set /p "DB_PORT=Porta [5432]: "
if not defined DB_PORT set "DB_PORT=5432"

set /p "DB_USER=Usuario PostgreSQL: "
if not defined DB_USER (
  echo ERRO: o usuario e obrigatorio.
  goto :failure
)

echo(%DB_HOST%| findstr /I /C:"%EXPECTED_PROJECT_REF%" >nul
if errorlevel 1 (
  echo(%DB_USER%| findstr /I /C:"%EXPECTED_PROJECT_REF%" >nul
  if errorlevel 1 (
    echo ERRO: nao encontrei o identificador esperado do projeto no host nem no usuario.
    echo Projeto esperado: %EXPECTED_PROJECT_REF%
    echo Confira os dados em Supabase Dashboard ^> Connect antes de continuar.
    goto :failure
  )
)

echo.
echo Projeto verificado: %EXPECTED_PROJECT_REF%
set /p "CONFIRM=Confirma que esta conexao pertence a esse projeto? [s/N]: "
if /I not "%CONFIRM%"=="s" (
  echo Backup cancelado.
  goto :failure
)

for /f %%I in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
if not defined STAMP (
  echo ERRO: nao foi possivel gerar o nome com data e hora.
  goto :failure
)

set "BACKUP_DIR=%USERPROFILE%\Documents\finance-advisor-backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if errorlevel 1 (
  echo ERRO: nao foi possivel criar a pasta de backup: %BACKUP_DIR%
  goto :failure
)

set "PARTIAL_FILE=%BACKUP_DIR%\financial_%EXPECTED_PROJECT_REF%_%STAMP%.partial.dump"
set "BACKUP_FILE=%BACKUP_DIR%\financial_%EXPECTED_PROJECT_REF%_%STAMP%.dump"

echo.
echo O pg_dump solicitara a senha do banco. A senha nao e a chave BRAPI.
echo.
pg_dump --host="%DB_HOST%" --port="%DB_PORT%" --username="%DB_USER%" --dbname=postgres --schema=public --schema=supabase_migrations --format=custom --no-owner --no-acl --password --verbose --file="%PARTIAL_FILE%"
if errorlevel 1 (
  echo.
  echo ERRO: pg_dump falhou. Qualquer arquivo parcial foi mantido para diagnostico:
  echo %PARTIAL_FILE%
  goto :failure
)

if not exist "%PARTIAL_FILE%" (
  echo ERRO: pg_dump terminou sem criar o arquivo esperado.
  goto :failure
)

for %%A in ("%PARTIAL_FILE%") do if %%~zA LEQ 0 (
  echo ERRO: o arquivo de backup esta vazio: %PARTIAL_FILE%
  goto :failure
)

pg_restore --list "%PARTIAL_FILE%" >nul 2>nul
if errorlevel 1 (
  echo ERRO: o arquivo foi criado, mas pg_restore nao conseguiu validar o indice do backup.
  echo Arquivo mantido para diagnostico: %PARTIAL_FILE%
  goto :failure
)

move /Y "%PARTIAL_FILE%" "%BACKUP_FILE%" >nul
if errorlevel 1 (
  echo ERRO: nao foi possivel finalizar o nome do arquivo de backup.
  echo Arquivo parcial mantido: %PARTIAL_FILE%
  goto :failure
)

for %%A in ("%BACKUP_FILE%") do set "BACKUP_SIZE=%%~zA"
echo.
echo Backup concluido e validado.
echo Arquivo: %BACKUP_FILE%
echo Tamanho: %BACKUP_SIZE% bytes
echo.
echo Guarde uma copia fora deste computador antes de qualquer reset do banco.
exit /b 0

:failure
echo.
echo Nenhum reset ou alteracao remota foi executado.
exit /b 1
