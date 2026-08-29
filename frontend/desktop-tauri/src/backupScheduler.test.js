import { describe, expect, it, vi } from "vitest";
import { BACKUP_INTERVAL_MS, runBackupCycle } from "./backupScheduler";

describe("backup scheduler", () => {
  it("backs up all fixed drives with the authenticated device", async () => {
    const native = { listFixedDrives: vi.fn().mockResolvedValue(["C:\\", "D:\\"]), runIncrementalBackup: vi.fn().mockResolvedValue({ uploadedFiles: 2 }) };
    const storage = { getItem: vi.fn((key) => ({ token: "token-1", screenMonitorDeviceId: "device-1" })[key]) };
    await runBackupCycle({ native, storage });
    expect(native.runIncrementalBackup).toHaveBeenCalledWith("token-1", "device-1", ["C:\\", "D:\\"]);
    expect(BACKUP_INTERVAL_MS).toBe(21_600_000);
  });

  it("does not scan before authentication and device registration", async () => {
    const native = { listFixedDrives: vi.fn(), runIncrementalBackup: vi.fn() };
    await runBackupCycle({ native, storage: { getItem: () => null } });
    expect(native.listFixedDrives).not.toHaveBeenCalled();
  });
});
