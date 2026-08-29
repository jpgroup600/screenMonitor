import { describe, expect, it, vi } from "vitest";
import { getOrCreateDeviceId } from "./deviceHeartbeat";

describe("getOrCreateDeviceId", () => {
  it("persists one stable id for future heartbeats", () => {
    const values = new Map();
    const storage = { getItem: vi.fn((key) => values.get(key)), setItem: vi.fn((key, value) => values.set(key, value)) };
    expect(getOrCreateDeviceId(storage, () => "device-1")).toBe("device-1");
    expect(getOrCreateDeviceId(storage, () => "device-2")).toBe("device-1");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
