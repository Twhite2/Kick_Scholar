# Brings the development database up.
#
# Postgres runs inside WSL2 because Windows Defender Application Control on
# this machine blocks the native Postgres binaries (unsigned
# libcrypto-3-x64.dll). The WSL VM shuts itself down when idle, taking Postgres
# with it, and every Prisma call then fails with ECONNREFUSED.
#
# Why this script is a one-liner rather than a keepalive: inside the distro,
# systemd is PID 1 and the postgresql unit is enabled, so *any* command that
# wakes the distro starts Postgres on its own. Nothing needs to be kept alive
# - the VM just needs waking.
#
# Two keepalive approaches were tried and both failed, so they are not worth
# repeating: a Windows-side `Start-Process wsl ... sleep infinity` dies with the
# shell that launched it, and a `setsid nohup sleep ... &` inside the distro is
# reaped when the wsl.exe session ends (verified: the process count came back
# 0). `vmIdleTimeout=86400000` is already set in %USERPROFILE%\.wslconfig and
# does not prevent the shutdown either.
#
# So: run this when the app starts reporting connection errors.
#
#   npm run db:up

$ErrorActionPreference = 'Stop'
$distro = 'Ubuntu-24.04'

Write-Host "Waking $distro (systemd starts PostgreSQL automatically)..."
# `service ... start` is harmless if systemd already brought it up, and covers
# the case where the unit was stopped by hand.
wsl -d $distro -u root service postgresql start | Out-Null

$status = wsl -d $distro -u root -- bash -c 'pg_isready -q && echo ready || echo notready'

if ($status -eq 'ready') {
  Write-Host "PostgreSQL is accepting connections."
  exit 0
}

Write-Host "PostgreSQL is NOT accepting connections."
Write-Host "Check with:  wsl -d $distro -u root service postgresql status"
exit 1
