import { describe, expect, it, vi } from "vitest";
import { diffUsbFiles, recordUsbFileCopies } from "./usbFileAudit";

describe("USB file audit", () => {
  it("uses the first scan as a baseline and detects later new or changed files", () => {
    const baseline = [{ path: "E:\\old.txt", size_bytes: 10, modified_unix_seconds: 1 }];
    expect(diffUsbFiles(null, baseline)).toEqual([]);
    expect(diffUsbFiles(baseline, [
      { path: "E:\\old.txt", size_bytes: 11, modified_unix_seconds: 2 },
      { path: "E:\\new.txt", size_bytes: 5, modified_unix_seconds: 1 },
    ]).map((file) => file.path)).toEqual(["E:\\old.txt", "E:\\new.txt"]);
  });

  it("records copied file path and size as a security event", async () => {
    const request = { post: vi.fn().mockResolvedValue({}) };
    await recordUsbFileCopies({ request, deviceId: "device-1", drive: "E:\\", files: [{ path: "E:\\secret.pdf", size_bytes: 42 }] });
    expect(request.post).toHaveBeenCalledWith("/security-events", expect.objectContaining({
      deviceId: "device-1", eventType: "FILE_COPY", source: "E:\\secret.pdf",
    }));
  });
});
