import { describe, expect, it, vi } from 'vitest';
import { defaultDeviceSecurityPolicy, loadDeviceSecurityPolicy, normalizeDeviceSecurityPolicy, sameDeviceSecurityPolicy } from './deviceSecurityPolicy';

describe('device security policy', () => {
  it('keeps safe enabled defaults when an older server omits a module', () => {
    expect(normalizeDeviceSecurityPolicy({ backupEnabled: false })).toEqual({ ...defaultDeviceSecurityPolicy, backupEnabled: false });
  });

  it('loads only the policy for the stable local device id', async () => {
    const request = { get: vi.fn().mockResolvedValue({ usbAuditEnabled: false }) };
    const storage = { getItem: vi.fn().mockReturnValue('device-1') };
    const policy = await loadDeviceSecurityPolicy({ request, storage });
    expect(request.get).toHaveBeenCalledWith('/security-policies/device/device-1/effective');
    expect(policy.usbAuditEnabled).toBe(false);
  });

  it('detects whether a refresh actually changed a module', () => {
    expect(sameDeviceSecurityPolicy(defaultDeviceSecurityPolicy, { ...defaultDeviceSecurityPolicy })).toBe(true);
    expect(sameDeviceSecurityPolicy(defaultDeviceSecurityPolicy, { ...defaultDeviceSecurityPolicy, backupEnabled: false })).toBe(false);
  });
});
