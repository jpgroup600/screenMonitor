import { afterEach, describe, expect, it, vi } from "vitest";
import { startAttendanceReminder } from "./attendanceReminder";

describe("attendance reminder", () => {
  afterEach(() => vi.useRealTimers());

  it("notifies every configured interval and stops after cleanup", async () => {
    vi.useFakeTimers();
    const notify = vi.fn();
    const stop = startAttendanceReminder(notify, 10 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    expect(notify).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(notify).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(notify).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
