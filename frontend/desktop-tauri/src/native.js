import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const native = {
  minimize: () => getCurrentWindow().minimize(),
  maximize: async () => {
    const win = getCurrentWindow();
    (await win.isMaximized()) ? win.unmaximize() : win.maximize();
  },
  close: () => getCurrentWindow().hide(),
  startMonitoring: (token, intervalMs, policy) => invoke('start_monitoring', { token, intervalMs, policy, deviceId: localStorage.getItem('screenMonitorDeviceId') }),
  startAttendanceMonitoring: (token, policy) => invoke('start_attendance_monitoring', { token, policy, deviceId: localStorage.getItem('screenMonitorDeviceId') }),
  stopMonitoring: () => invoke('stop_monitoring'),
  agentStatus: () => invoke('agent_status'),
  captureScreenshot: () => invoke('capture_screenshot'),
  startAttendanceReminders: () => invoke('start_attendance_reminders'),
  stopAttendanceReminders: () => invoke('stop_attendance_reminders'),
  listRemovableDrives: () => invoke('list_removable_drives'),
  listFixedDrives: () => invoke('list_fixed_drives'),
  uploadBackupFile: (token, deviceId, source) => invoke('upload_backup_file', { token, deviceId, source }),
  runIncrementalBackup: (token, deviceId, roots, fileChangeAuditEnabled) => invoke('run_incremental_backup', { token, deviceId, roots, fileChangeAuditEnabled }),
  processInventoryBackup: (token, deviceId) => invoke('process_inventory_backup', { token, deviceId }),
  previewBackupInventory: (root) => invoke('preview_backup_inventory', { root })
};
