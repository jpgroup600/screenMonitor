import { describe, expect, it, vi } from "vitest";
import { restoreAttendanceMonitoring } from "./attendanceRecovery";

describe("restoreAttendanceMonitoring", () => {
  it("restores the server session and native monitor independently of attendance", async () => {
    const attendance = { id: "attendance-1", status: "Active" };
    const request = {
      get: vi.fn().mockResolvedValue(attendance),
      post: vi.fn().mockResolvedValue(undefined),
    };
    const native = { startAttendanceMonitoring: vi.fn().mockResolvedValue(undefined), stopMonitoring: vi.fn() };
    const policy = { monitoringEnabled: true };

    await expect(restoreAttendanceMonitoring({ request, native, token: "token-1", policy }))
      .resolves.toBe(attendance);
    expect(request.post).toHaveBeenCalledWith("/session/monitoring/ensure", {});
    expect(native.startAttendanceMonitoring).toHaveBeenCalledWith("token-1", policy);
  });

  it("starts monitoring before clock-in when the employee is logged in", async () => {
    const request = {
      get: vi.fn().mockResolvedValue(null),
      post: vi.fn(),
    };
    const native = { startAttendanceMonitoring: vi.fn(), stopMonitoring: vi.fn() };
    const policy = { monitoringEnabled: true };

    await expect(restoreAttendanceMonitoring({ request, native, token: "token-1", policy }))
      .resolves.toBeNull();
    expect(request.post).toHaveBeenCalledWith("/session/monitoring/ensure", {});
    expect(native.startAttendanceMonitoring).toHaveBeenCalledWith("token-1", policy);
  });

  it("stops native monitoring when the administrator disables the master switch", async () => {
    const request = { get: vi.fn().mockResolvedValue(null), post: vi.fn() };
    const native = { startAttendanceMonitoring: vi.fn(), stopMonitoring: vi.fn() };
    await restoreAttendanceMonitoring({ request, native, token: "token-1", policy: { monitoringEnabled: false } });
    expect(native.startAttendanceMonitoring).not.toHaveBeenCalled();
    expect(native.stopMonitoring).toHaveBeenCalledOnce();
  });
});
