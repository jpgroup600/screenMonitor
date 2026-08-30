export const SECURITY_EVENT_LABELS = {
  AGENT_STARTED: '에이전트 시작',
  AGENT_STOPPED: '에이전트 중지',
  USB_CONNECTED: 'USB 연결',
  USB_DISCONNECTED: 'USB 해제',
  USB_FILE_WRITTEN: 'USB 파일 생성·변경',
  FILE_COPY: '파일 복사',
  FILE_CREATED: '파일 생성',
  FILE_MODIFIED: '파일 수정',
  FILE_DELETED: '파일 삭제',
  FILE_MOVED: '파일 이동',
  NETWORK_CONNECTION: '외부 네트워크 연결',
  NETWORK_TRANSFER: '확인된 네트워크 전송',
};

export function securityEventLabel(type) {
  return SECURITY_EVENT_LABELS[type] || type;
}
