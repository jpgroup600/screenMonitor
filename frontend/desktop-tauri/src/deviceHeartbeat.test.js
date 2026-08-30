import { describe, expect, it, vi } from "vitest";
import { getOrCreateDeviceId, restoreAuthorizedMonitoring, sendDeviceHeartbeat } from "./deviceHeartbeat";

describe("getOrCreateDeviceId", () => {
  it("persists one stable id for future heartbeats", () => {
    const values = new Map();
    const storage = { getItem: vi.fn((key) => values.get(key)), setItem: vi.fn((key, value) => values.set(key, value)) };
    expect(getOrCreateDeviceId(storage, () => "device-1")).toBe("device-1");
    expect(getOrCreateDeviceId(storage, () => "device-2")).toBe("device-1");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});

it("heartbeats publish visible agent mode, runtime state, and queue health", async () => {
  const request = { post: vi.fn().mockResolvedValue({}) };
  const storage = { getItem: vi.fn(() => "device-1"), setItem: vi.fn() };
  const native = { agentStatus: vi.fn().mockResolvedValue({ agentVersion: "2.0.0", agentMode: "UserSession", monitoringState: "Running", pendingQueueItems: 3 }) };
  await sendDeviceHeartbeat({ request, storage, native, platform: () => ({ name: "Windows", operatingSystem: "Windows 11" }) });
  expect(request.post).toHaveBeenCalledWith("/devices/heartbeat", {
    deviceId: "device-1", name: "Windows", operatingSystem: "Windows 11", agentVersion: "2.0.0",
    agentMode: "UserSession", monitoringState: "Running", pendingQueueItems: 3,
  });
});

describe("restoreAuthorizedMonitoring", () => {
  it("restores monitoring only after an accepted heartbeat", async () => {
    const order = [];
    await restoreAuthorizedMonitoring({ heartbeat: async () => order.push("heartbeat"), restore: async () => order.push("restore") });
    expect(order).toEqual(["heartbeat", "restore"]);
  });

  it("does not restore a blocked device", async () => {
    const restore = vi.fn();
    await expect(restoreAuthorizedMonitoring({ heartbeat: async () => { throw new Error("blocked"); }, restore })).rejects.toThrow("blocked");
    expect(restore).not.toHaveBeenCalled();
  });
});
