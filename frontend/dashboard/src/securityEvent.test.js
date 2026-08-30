import test from 'node:test';
import assert from 'node:assert/strict';
import { securityEventLabel } from './securityEvent.js';

test('security event types have administrator-friendly labels', () => {
  assert.equal(securityEventLabel('AGENT_STARTED'), '에이전트 시작');
  assert.equal(securityEventLabel('USB_CONNECTED'), 'USB 연결');
  assert.equal(securityEventLabel('USB_FILE_WRITTEN'), 'USB 파일 생성·변경');
  assert.equal(securityEventLabel('FILE_COPY'), '파일 복사');
  assert.equal(securityEventLabel('FILE_CREATED'), '파일 생성');
  assert.equal(securityEventLabel('FILE_MODIFIED'), '파일 수정');
  assert.equal(securityEventLabel('FILE_DELETED'), '파일 삭제');
  assert.equal(securityEventLabel('FILE_MOVED'), '파일 이동');
  assert.equal(securityEventLabel('NETWORK_CONNECTION'), '외부 네트워크 연결');
  assert.equal(securityEventLabel('NETWORK_TRANSFER'), '확인된 네트워크 전송');
  assert.equal(securityEventLabel('CUSTOM'), 'CUSTOM');
});
