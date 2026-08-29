import { describe, expect, it, vi } from "vitest";
import { restoreAttendanceMonitoring } from "./attendanceRecovery";

describe("restoreAttendanceMonitoring", () => {
  it("restores the server session and native monitor for active attendance", async () => {
    const attendance = { id: "attendance-1", status: "Active" };
    const request = {
      get: vi.fn().mockResolvedValue(attendance),
      post: vi.fn().mockResolvedValue(undefined),
    };
    const native = { startAttendanceMonitoring: vi.fn().mockResolvedValue(undefined) };

    await expect(restoreAttendanceMonitoring({ request, native, token: "token-1" }))
      .resolves.toBe(attendance);
    expect(request.post).toHaveBeenCalledWith("/attendance/resume-monitoring", {});
    expect(native.startAttendanceMonitoring).toHaveBeenCalledWith("token-1");
  });

  it("does not start monitoring before clock-in", async () => {
    const request = {
      get: vi.fn().mockResolvedValue(null),
      post: vi.fn(),
    };
    const native = { startAttendanceMonitoring: vi.fn() };

    await expect(restoreAttendanceMonitoring({ request, native, token: "token-1" }))
      .resolves.toBeNull();
    expect(request.post).not.toHaveBeenCalled();
    expect(native.startAttendanceMonitoring).not.toHaveBeenCalled();
  });
});
