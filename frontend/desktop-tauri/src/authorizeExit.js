import axios from 'axios';

export async function authorizeExit({ email, password, reason, deviceId, client = axios }) {
  if (!email?.trim() || !password || !reason?.trim() || reason.trim().length < 3 || !deviceId) {
    throw new Error('관리자 계정과 3자 이상의 종료 사유를 입력해주세요.');
  }
  const baseURL = import.meta.env.VITE_BACKEND_URL;
  const login = await client.post(`${baseURL}/admin/login`, { email: email.trim(), password });
  const adminToken = login.data?.token ?? login.data?.Token;
  if (!adminToken) throw new Error('관리자 인증에 실패했습니다.');
  const approval = await client.post(`${baseURL}/agent-exit/authorize`,
    { deviceId, reason: reason.trim() },
    { headers: { Authorization: `Bearer ${adminToken}` } });
  return approval.data;
}
