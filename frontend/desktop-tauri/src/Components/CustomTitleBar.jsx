import React, { useEffect, useState } from "react";
import { AiOutlineClose, AiOutlineMinus, AiOutlineExpand } from "react-icons/ai";
import { listen } from '@tauri-apps/api/event';
import { native } from "../native";
import { authorizeExit } from '../authorizeExit';

export default function CustomTitleBar() {
  const [showExit, setShowExit] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const handleMinimize = () => native.minimize();
  const handleMaximize = () => native.maximize();
  const handleClose = () => setShowExit(true);
  useEffect(() => { let dispose; listen('authorized-exit-requested', () => setShowExit(true)).then(value => { dispose = value; }); return () => dispose?.(); }, []);
  const hideToBackground = () => { setShowExit(false); native.close().catch(console.error); };
  const submitExit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const deviceId = localStorage.getItem('screenMonitorDeviceId');
      const grant = await authorizeExit({ ...form, deviceId });
      await native.completeAuthorizedExit(deviceId, grant.token ?? grant.Token);
    } catch (value) {
      setError(value?.response?.status === 401 ? '관리자 ID 또는 비밀번호가 올바르지 않습니다.' : (value?.message || '완전 종료에 실패했습니다.'));
      setBusy(false);
    }
  };

  return (
    <><div className="absolute flex justify-between items-center bg-[#020617] text-white h-6 w-screen pl-4 select-none">
      {/* Draggable Area */}
      <div className="text-gray-400 flex-1 drag" data-tauri-drag-region>출퇴근 관리 프로그램</div>
      
      {/* Buttons */}
      <div className="flex">
        <button className="hover:bg-gray-700 p-2 non-draggable" onClick={handleMinimize}>
          <AiOutlineMinus size={12} />
        </button>
        <button className="hover:bg-gray-700 p-2 non-draggable" onClick={handleMaximize}>
          <AiOutlineExpand size={12} />
        </button>
        <button className="hover:bg-red-600 p-2 non-draggable" onClick={handleClose}>
          <AiOutlineClose size={12} />
        </button>
      </div>
    </div>
    {showExit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={submitExit} className="w-96 rounded-lg bg-white p-6 text-slate-900 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">프로그램 완전 종료</h2>
        <input className="mb-3 w-full rounded border p-2" type="email" placeholder="관리자 ID (이메일)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="mb-3 w-full rounded border p-2" type="password" placeholder="관리자 비밀번호" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <textarea className="mb-3 w-full rounded border p-2" placeholder="종료 사유 (3자 이상)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2" onClick={hideToBackground}>백그라운드로 닫기</button>
          <button type="submit" disabled={busy} className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-50">{busy ? '확인 중…' : '완전 종료'}</button>
        </div>
      </form>
    </div>}</>
  );
}
