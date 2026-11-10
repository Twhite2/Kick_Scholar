' Keeps the WSL VM awake continuously, with no visible window.
'
' Measured behaviour on this machine: the VM goes from Running to Stopped in
' under 15 seconds of inactivity, despite vmIdleTimeout=86400000 in
' .wslconfig. A scheduled task firing once a minute - the shortest interval
' Task Scheduler offers - therefore left it asleep roughly three quarters of
' the time, which is why the once-a-minute version fixed nothing.
'
' So this loops internally, poking every few seconds. The task still fires
' every minute (a logon-triggered task needs elevation; a per-minute one does
' not), and its MultipleInstancesPolicy of IgnoreNew turns those repeated
' launches into a single long-lived loop that is restarted within a minute if
' it ever dies. Keeping the single-instance rule in the scheduler rather than
' in this script avoids hand-rolled process detection.
'
' WScript.Shell.Run with windowStyle 0 is the only way to launch a console
' program with no window at all and without administrator rights, which
' matters at this frequency.
'
' Argument 0 is the distro name.

Option Explicit

Dim shell, distro, intervalMs
Set shell = CreateObject("WScript.Shell")

If WScript.Arguments.Count > 0 Then
  distro = WScript.Arguments(0)
Else
  distro = "Ubuntu-24.04"
End If

' Comfortably under the observed sub-15-second idle window.
intervalMs = 8000

Do While True
  On Error Resume Next
  ' 0 = hidden window, True = wait, so pokes cannot pile up if WSL is slow.
  ' `true` is the cheapest command that still counts as VM activity.
  shell.Run "wsl.exe -d " & distro & " -u root -- true", 0, True
  On Error Goto 0
  WScript.Sleep intervalMs
Loop
