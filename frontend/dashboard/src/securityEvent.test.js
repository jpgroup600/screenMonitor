import test from 'node:test';
import assert from 'node:assert/strict';
import { securityEventLabel } from './securityEvent.js';

test('security event types have administrator-friendly labels', () => {
  assert.equal(securityEventLabel('USB_CONNECTED'), 'USB 연결');
  assert.equal(securityEventLabel('FILE_COPY'), '파일 복사');
  assert.equal(securityEventLabel('FILE_DELETED'), '파일 삭제');
  assert.equal(securityEventLabel('FILE_MOVED'), '파일 이동');
  assert.equal(securityEventLabel('CUSTOM'), 'CUSTOM');
});
