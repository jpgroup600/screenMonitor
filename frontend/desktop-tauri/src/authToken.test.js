import { describe, expect, it, vi } from 'vitest';
import { initializeAuthToken, removeAuthToken, saveAuthToken } from './authToken';

describe('secure authentication token migration', () => {
  it('moves a legacy plaintext token into native secure storage and removes it', async () => {
    const native = { storeAuthToken: vi.fn(), loadAuthToken: vi.fn() };
    const storage = { getItem: vi.fn().mockReturnValue('legacy-jwt'), removeItem: vi.fn() };
    await expect(initializeAuthToken({ native, storage })).resolves.toBe('legacy-jwt');
    expect(native.storeAuthToken).toHaveBeenCalledWith('legacy-jwt');
    expect(storage.removeItem).toHaveBeenCalledWith('token');
    expect(native.loadAuthToken).not.toHaveBeenCalled();
  });

  it('loads, saves and clears tokens only through native storage', async () => {
    const native = { loadAuthToken: vi.fn().mockResolvedValue('secure-jwt'), storeAuthToken: vi.fn(), clearAuthToken: vi.fn() };
    const storage = { getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() };
    await expect(initializeAuthToken({ native, storage })).resolves.toBe('secure-jwt');
    await expect(saveAuthToken({ native, storage, token: 'new-jwt' })).resolves.toBe('new-jwt');
    await removeAuthToken({ native, storage });
    expect(native.storeAuthToken).toHaveBeenCalledWith('new-jwt');
    expect(native.clearAuthToken).toHaveBeenCalled();
  });
});
