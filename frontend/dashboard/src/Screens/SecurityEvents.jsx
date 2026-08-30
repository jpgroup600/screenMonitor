import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiSearch, FiShield } from 'react-icons/fi';
import request from '../Actions/request';
import { securityEventLabel } from '../securityEvent';

export default function SecurityEvents() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    try { setError(''); setEvents(await request.get('/security-events?take=500')); }
    catch (loadError) { console.error(loadError); setError('보안 이벤트를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const timer = window.setInterval(load, 15_000); return () => window.clearInterval(timer); }, []);
  const rows = useMemo(() => events.filter((event) => {
    if (filter && event.eventType !== filter) return false;
    const keyword = search.trim().toLowerCase();
    return !keyword || [event.employeeName, event.deviceId, event.source].some((value) => String(value || '').toLowerCase().includes(keyword));
  }), [events, filter, search]);

  return <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-blue-400">SECURITY AUDIT</p><h1 className="mt-1 text-3xl font-bold">보안 이벤트</h1><p className="mt-2 text-sm text-slate-400">USB 연결과 파일·네트워크 반출 감사 기록을 확인합니다.</p></div><button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>새로고침</button></header>
    <section className="grid gap-4 sm:grid-cols-3"><Summary label="전체 이벤트" value={events.length} icon={FiShield}/><Summary label="USB 연결" value={events.filter((event) => event.eventType === 'USB_CONNECTED').length} icon={FiAlertTriangle} color="text-amber-400"/><Summary label="Warning" value={events.filter((event) => event.severity === 'Warning').length} icon={FiAlertTriangle} color="text-rose-400"/></section>
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"><div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="">전체 유형</option><option value="USB_CONNECTED">USB 연결</option><option value="USB_DISCONNECTED">USB 해제</option><option value="FILE_COPY">파일 복사</option><option value="FILE_CREATED">파일 생성</option><option value="FILE_MODIFIED">파일 수정</option><option value="FILE_DELETED">파일 삭제</option><option value="FILE_MOVED">파일 이동</option><option value="NETWORK_TRANSFER">네트워크 반출</option></select><label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><FiSearch/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원·장치·경로 검색" className="w-60 bg-transparent text-sm outline-none"/></label></div>
      {error && <div className="p-10 text-center text-rose-400">{error}</div>}{!error && loading && <div className="p-10 text-center text-slate-400">불러오는 중...</div>}{!error && !loading && rows.length === 0 && <div className="p-10 text-center text-slate-500">보안 이벤트가 없습니다.</div>}
      {!error && !loading && rows.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950/80 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">시간</th><th className="px-5 py-4">유형</th><th className="px-5 py-4">직원</th><th className="px-5 py-4">장치</th><th className="px-5 py-4">대상</th><th className="px-5 py-4">심각도</th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map((event) => <tr key={event.id} className="hover:bg-slate-800/50"><td className="whitespace-nowrap px-5 py-4">{new Date(event.occurredAt).toLocaleString()}</td><td className="px-5 py-4 font-medium">{securityEventLabel(event.eventType)}</td><td className="px-5 py-4">{event.employeeName || event.employeeId}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">{event.deviceId}</td><td className="px-5 py-4 font-mono">{event.source || '-'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${event.severity === 'Warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{event.severity}</span></td></tr>)}</tbody></table></div>}
    </section>
  </div></div>;
}
function Summary({label,value,icon:Icon,color='text-blue-400'}) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex justify-between"><p className="text-sm text-slate-400">{label}</p><Icon className={color}/></div><p className="mt-3 text-3xl font-bold">{value}</p></div>; }
