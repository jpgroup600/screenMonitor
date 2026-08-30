import { describe, expect, it, vi } from "vitest";
import { BACKUP_INTERVAL_MS, runBackupCycle, runBackupQueueCycle } from "./backupScheduler";

describe("backup scheduler", () => {
  it("backs up all fixed drives with the authenticated device", async () => {
    const native = { listFixedDrives: vi.fn().mockResolvedValue(["C:\\", "D:\\"]), runIncrementalBackup: vi.fn().mockResolvedValue({ uploadedFiles: 2 }) };
    const storage = { getItem: vi.fn((key) => ({ token: "token-1", screenMonitorDeviceId: "device-1" })[key]) };
    await runBackupCycle({ native, storage, policy: { fileChangeAuditEnabled: true } });
    expect(native.runIncrementalBackup).toHaveBeenCalledWith("token-1", "device-1", ["C:\\", "D:\\"], true);
    expect(BACKUP_INTERVAL_MS).toBe(21_600_000);
  });

  it("does not scan before authentication and device registration", async () => {
    const native = { listFixedDrives: vi.fn(), runIncrementalBackup: vi.fn() };
    await runBackupCycle({ native, storage: { getItem: () => null } });
    expect(native.listFixedDrives).not.toHaveBeenCalled();
  });

  it("processes only the server-approved inventory queue", async () => {
    const native = { processInventoryBackup: vi.fn().mockResolvedValue({ uploadedFiles: 3 }) };
    const storage = { getItem: vi.fn((key) => ({ token: "token-1", screenMonitorDeviceId: "device-1" })[key]) };
    await runBackupQueueCycle({ native, storage });
    expect(native.processInventoryBackup).toHaveBeenCalledWith("token-1", "device-1");
  });
});
