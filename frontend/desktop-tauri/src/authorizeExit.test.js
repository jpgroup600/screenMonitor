import { describe, expect, it, vi } from 'vitest';
import { authorizeExit } from './authorizeExit';

describe('authorized exit', () => {
  it('uses an admin token to request a device-bound one-time grant', async () => {
    const client = { post: vi.fn()
      .mockResolvedValueOnce({ data: { token: 'admin-token' } })
      .mockResolvedValueOnce({ data: { token: 'exit-grant' } }) };
    const result = await authorizeExit({ email: 'admin@test.com', password: 'pw', reason: '점검 종료', deviceId: 'device-1', client });
    expect(result.token).toBe('exit-grant');
    expect(client.post.mock.calls[1][1]).toEqual({ deviceId: 'device-1', reason: '점검 종료' });
    expect(client.post.mock.calls[1][2].headers.Authorization).toBe('Bearer admin-token');
  });

  it('rejects an empty reason before contacting the server', async () => {
    const client = { post: vi.fn() };
    await expect(authorizeExit({ email: 'a', password: 'p', reason: '', deviceId: 'd', client })).rejects.toThrow();
    expect(client.post).not.toHaveBeenCalled();
  });
});
