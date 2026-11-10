# Installs (or removes) a Windows scheduled task that keeps the WSL VM awake,
# so the development Postgres inside it stays reachable.
#
# The problem, precisely: the WSL2 VM sleeps and takes Postgres with it. A
# `wsl` command from the Windows side wakes it; a TCP connect to port 5432
# does not. So Prisma calls from `next dev` fail with ECONNREFUSED while
# anything run from a terminal looks fine - the act of testing woke the VM,
# which is why this presented as intermittent and was misdiagnosed repeatedly.
#
# Measured: Running -> Stopped in under 15 seconds of inactivity.
#
#   12:25:35 Stopped / 12:25:50 Stopped / 12:26:05 Running (task fired)
#   12:26:21 Stopped / 12:26:36 Stopped / 12:26:51 Stopped
#
# That is why the keepalive loops every 8 seconds rather than relying on the
# scheduler's one-minute minimum interval.
#
# Approaches that did NOT work, recorded so they are not retried:
#   - Start-Process wsl ... sleep infinity  dies with the shell that spawned it
#   - setsid nohup sleep ... & inside WSL   reaped with the wsl.exe session
#                                           (process count verified 0)
#   - vmIdleTimeout=86400000 in .wslconfig  already set; does not prevent it
#   - Register-ScheduledTask                Access denied here, S4U and
#                                           Interactive alike
#   - schtasks /SC ONLOGON                  Access denied (needs elevation)
#   - schtasks /SC MINUTE alone             too slow; VM asleep ~75% of the time
#
# What works: schtasks /XML, which needs no elevation, with a one-minute
# repetition, MultipleInstancesPolicy IgnoreNew so those repeats collapse into
# a single long-lived loop, and no execution time limit so it is never killed.
#
#   Install:  npm run db:task:install
#   Remove:   npm run db:task:install -- -Remove
#   Inspect:  schtasks /Query /TN KickScholar-WSL-Keepalive /V /FO LIST

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$taskName = 'KickScholar-WSL-Keepalive'
$distro = 'Ubuntu-24.04'

function Stop-ExistingLoop {
  Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*wsl-poke.vbs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Remove) {
  schtasks /Delete /TN $taskName /F 2>&1 | Out-Null
  Stop-ExistingLoop
  Write-Host "Removed '$taskName' and stopped any running keepalive."
  exit 0
}

$poke = Join-Path $PSScriptRoot 'wsl-poke.vbs'
if (-not (Test-Path $poke)) { throw "Missing launcher: $poke" }

# Start one minute in the past so the first repetition is due immediately.
$start = (Get-Date).AddMinutes(-1).ToString('yyyy-MM-ddTHH:mm:ss')
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Keeps the WSL2 VM awake so the KickScholar development PostgreSQL stays reachable.</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT1M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$env:USERNAME</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>//B //Nologo "$poke" $distro</Arguments>
    </Exec>
  </Actions>
</Task>
"@

$xmlPath = Join-Path $env:TEMP 'kickscholar-wsl-keepalive.xml'
# Task Scheduler requires UTF-16 for imported XML.
[System.IO.File]::WriteAllText($xmlPath, $xml, [System.Text.Encoding]::Unicode)

Stop-ExistingLoop
schtasks /Create /TN $taskName /XML $xmlPath /F
if ($LASTEXITCODE -ne 0) { throw "schtasks /XML failed with exit code $LASTEXITCODE" }

schtasks /Run /TN $taskName | Out-Null
Start-Sleep -Seconds 6

$loops = @(Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*wsl-poke.vbs*' }).Count
$status = wsl -d $distro -u root -- bash -c 'pg_isready -q && echo ready || echo notready'

Write-Host ""
Write-Host "Installed '$taskName'."
Write-Host "  keepalive loops running : $loops (expected 1)"
Write-Host "  postgres                : $status"
Write-Host "  remove with             : npm run db:task:install -- -Remove"
