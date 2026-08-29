import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const native = {
  minimize: () => getCurrentWindow().minimize(),
  maximize: async () => {
    const win = getCurrentWindow();
    (await win.isMaximized()) ? win.unmaximize() : win.maximize();
  },
  close: () => getCurrentWindow().close(),
  startMonitoring: (token, intervalMs) => invoke('start_monitoring', { token, intervalMs }),
  stopMonitoring: () => invoke('stop_monitoring'),
  captureScreenshot: () => invoke('capture_screenshot')
};
