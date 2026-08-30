export const SECURITY_EVENT_LABELS = {
  USB_CONNECTED: 'USB 연결',
  USB_DISCONNECTED: 'USB 해제',
  FILE_COPY: '파일 복사',
  FILE_DELETED: '파일 삭제',
  FILE_MOVED: '파일 이동',
  NETWORK_TRANSFER: '외부 네트워크 연결',
};

export function securityEventLabel(type) {
  return SECURITY_EVENT_LABELS[type] || type;
}
