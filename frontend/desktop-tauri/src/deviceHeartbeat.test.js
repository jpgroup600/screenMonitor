import { describe, expect, it, vi } from "vitest";
import { getOrCreateDeviceId, restoreAuthorizedMonitoring } from "./deviceHeartbeat";

describe("getOrCreateDeviceId", () => {
  it("persists one stable id for future heartbeats", () => {
    const values = new Map();
    const storage = { getItem: vi.fn((key) => values.get(key)), setItem: vi.fn((key, value) => values.set(key, value)) };
    expect(getOrCreateDeviceId(storage, () => "device-1")).toBe("device-1");
    expect(getOrCreateDeviceId(storage, () => "device-2")).toBe("device-1");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
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
