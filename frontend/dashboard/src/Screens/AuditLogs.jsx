import { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiRefreshCw, FiShield, FiXCircle } from 'react-icons/fi';
import request from '../Actions/request';
import { auditActionLabel, changedPolicyKeys } from '../auditLog';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [entries, result] = await Promise.all([
        request.get('/security-policies/audit?take=500'),
        request.get('/security-policies/audit/integrity'),
      ]);
      setLogs(entries || []); setIntegrity(Boolean(result.valid));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex items-end justify-between"><div><p className="text-sm font-medium text-blue-400">ADMIN AUDIT</p><h1 className="mt-1 text-3xl font-bold">관리자 감사 로그</h1><p className="mt-2 text-sm text-slate-400">관리자 정책 변경과 연결 해시 무결성을 확인합니다.</p></div><button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>새로고침</button></header>
    <section className={`flex items-center gap-3 rounded-xl border p-4 ${integrity === false ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{integrity === false ? <FiXCircle/> : <FiCheckCircle/>}<div><p className="font-semibold">{integrity === null ? '무결성 확인 중' : integrity ? '감사 체인 정상' : '감사 체인 손상 감지'}</p><p className="text-xs opacity-80">각 기록은 이전 기록의 SHA-256 해시와 연결됩니다.</p></div></section>
    <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs text-slate-500"><tr><th className="px-4 py-3">순번</th><th className="px-4 py-3">시각</th><th className="px-4 py-3">관리자</th><th className="px-4 py-3">행위</th><th className="px-4 py-3">대상</th><th className="px-4 py-3">변경 항목</th><th className="px-4 py-3">해시</th></tr></thead><tbody className="divide-y divide-slate-800">{logs.map((log) => <tr key={log.id}><td className="px-4 py-3">{log.sequence}</td><td className="whitespace-nowrap px-4 py-3">{new Date(log.occurredAt).toLocaleString()}</td><td className="px-4 py-3 font-mono text-xs">{log.adminId}</td><td className="px-4 py-3">{auditActionLabel(log.action)}</td><td className="px-4 py-3 font-mono text-xs">{log.targetId}</td><td className="px-4 py-3 text-xs">{changedPolicyKeys(log.beforeJson, log.afterJson).join(', ') || '-'}</td><td className="max-w-40 truncate px-4 py-3 font-mono text-xs" title={log.entryHash}>{log.entryHash}</td></tr>)}</tbody></table>{!logs.length && !loading && <p className="p-10 text-center text-slate-500">감사 기록이 없습니다.</p>}</div>
  </div></div>;
}
