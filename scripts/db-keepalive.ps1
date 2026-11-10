# Keeps the WSL VM awake for as long as this window is open.
#
# The problem this solves, precisely: the WSL2 VM sleeps after a minute or two
# of inactivity and Postgres goes with it. A `wsl` command wakes it; a plain
# TCP connect to localhost:5432 does not. So Prisma calls from `next dev` get
# ECONNREFUSED while any command run from a terminal appears to work - which
# is why this looked intermittent and kept being misdiagnosed.
#
# `vmIdleTimeout=86400000` in %USERPROFILE%\.wslconfig does not prevent it, and
# neither does holding a process open inside the distro (tried, verified dead).
# Poking WSL from the Windows side on a timer does.
#
# Run this in its own terminal, alongside `npm run dev`:
#
#   npm run db:keepalive
#
# Ctrl+C stops it. Nothing is installed and nothing persists after you close
# the window - if you would rather not keep a terminal open, a Windows
# scheduled task running the same one-line command is the permanent version.

$distro = 'Ubuntu-24.04'
$intervalSeconds = 30

Write-Host "Keeping $distro awake every ${intervalSeconds}s. Ctrl+C to stop."
Write-Host ""

while ($true) {
  $stamp = Get-Date -Format 'HH:mm:ss'
  try {
    # `true` is the cheapest command that still counts as VM activity.
    wsl -d $distro -u root -- true 2>$null
    $ready = wsl -d $distro -u root -- bash -c 'pg_isready -q && echo up || echo down' 2>$null
    if ($ready -ne 'up') {
      wsl -d $distro -u root service postgresql start | Out-Null
      Write-Host "$stamp  postgres was down - restarted"
    }
  } catch {
    Write-Host "$stamp  could not reach WSL: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds $intervalSeconds
}
