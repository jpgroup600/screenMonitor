import { describe, expect, it, vi } from 'vitest';
import { diffRemovableDrives, recordUsbChanges } from './usbAudit';

describe('USB audit', () => {
  it('detects connected and disconnected drive transitions', () => {
    expect(diffRemovableDrives(['E:\\', 'F:\\'], ['F:\\', 'G:\\'])).toEqual({ connected: ['G:\\'], disconnected: ['E:\\'] });
  });

  it('records each transition with the stable device id', async () => {
    const request = { post: vi.fn().mockResolvedValue({}) };
    await recordUsbChanges({ request, deviceId: 'device-1', changes: { connected: ['E:\\'], disconnected: ['F:\\'] } });
    expect(request.post).toHaveBeenCalledTimes(2);
    expect(request.post).toHaveBeenCalledWith('/security-events', expect.objectContaining({ deviceId: 'device-1', eventType: 'USB_CONNECTED', source: 'E:\\' }));
  });
});
