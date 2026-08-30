!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$COMMONAPPDATA\ScreenMonitor"
  nsExec::ExecToLog 'icacls "$COMMONAPPDATA\ScreenMonitor" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "$USERNAME:(OI)(CI)M"'
  ExecWait '"$INSTDIR\screen-monitor-agent.exe" install'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\screen-monitor-agent.exe" uninstall'
!macroend
