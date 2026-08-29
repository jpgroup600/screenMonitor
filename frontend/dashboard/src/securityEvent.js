export const SECURITY_EVENT_LABELS = {
  USB_CONNECTED: 'USB 연결',
  USB_DISCONNECTED: 'USB 해제',
  FILE_COPY: '파일 복사',
  NETWORK_TRANSFER: '네트워크 반출',
};

export function securityEventLabel(type) {
  return SECURITY_EVENT_LABELS[type] || type;
}
