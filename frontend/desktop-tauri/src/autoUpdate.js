import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function installAvailableUpdate() {
  const update = await check();
  if (!update) return false;

  await update.downloadAndInstall();
  await relaunch();
  return true;
}
