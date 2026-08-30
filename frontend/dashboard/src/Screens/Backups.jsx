import { useCallback, useEffect, useState } from 'react';
import { FiArchive, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import request from '../Actions/request';
import { formatBytes, newestVersionsFirst, restoreRequestPayload } from '../backupFile';

const statusLabel = { Scanning: '파일 목록 수집 중', InventoryReady: '정책 확인 대기', BackingUp: '백업 진행 중', Completed: '완료', Pending: '대기', BackedUp: '완료', Failed: '실패', Excluded: '제외' };

export default function Backups() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [progress, setProgress] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    const values = await request.get('/backups/inventory/runs?take=50');
    setRuns(values || []);
    setRunId((current) => current || values?.[0]?.id || '');
  }, []);

  const loadInventory = useCallback(async () => {
    if (!runId) return;
    const query = new URLSearchParams({ take: '500' });
    if (inventorySearch.trim()) query.set('search', inventorySearch.trim());
    if (inventoryStatus) query.set('status', inventoryStatus);
    const [nextProgress, items] = await Promise.all([
      request.get(`/backups/inventory/runs/${runId}/progress`),
      request.get(`/backups/inventory/runs/${runId}/files?${query}`),
    ]);
    setProgress(nextProgress); setInventory(items || []);
  }, [runId, inventorySearch, inventoryStatus]);

  const loadArchive = useCallback(async () => {
    const query = new URLSearchParams({ take: '500' });
    if (search.trim()) query.set('search', search.trim());
    setFiles(await request.get(`/backups?${query}`));
  }, [search]);

  const refresh = useCallback(async () => {
    try { setLoading(true); setMessage(''); await loadRuns(); await Promise.all([loadInventory(), loadArchive()]); }
    catch (error) { console.error(error); setMessage('백업 정보를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [loadRuns, loadInventory, loadArchive]);

  useEffect(() => { loadRuns().then(loadArchive).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadInventory(); const timer = window.setInterval(loadInventory, 5000); return () => window.clearInterval(timer); }, [loadInventory]);

  const setRule = async (item, action) => {
    const run = runs.find((value) => value.id === runId);
    await request.put('/backups/inventory/rules', { deviceId: run.deviceId, path: item.path, action });
    setMessage(`${item.path} 경로를 ${action === 'Exclude' ? '블랙리스트' : '화이트리스트'}로 설정했습니다.`);
    await loadInventory();
  };
  const startBackup = async () => { await request.post(`/backups/inventory/runs/${runId}/start-backup`, {}); setMessage('순차 백업을 시작했습니다.'); await loadInventory(); };
  const openDetail = async (id) => setSelected(await request.get(`/backups/${id}`));
  const restore = async (versionId) => { await request.post('/backups/restore-requests', restoreRequestPayload(versionId)); setMessage('원본 장치에 복원 요청을 보냈습니다.'); };

  return <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-blue-400">BACKUP INVENTORY</p><h1 className="mt-1 text-3xl font-bold">파일 목록 및 백업</h1><p className="mt-2 text-sm text-slate-400">파일 목록을 먼저 확인하고 포함·제외 정책과 백업 진행 상황을 관리합니다.</p></div><button onClick={refresh} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>새로고침</button></header>
    {message && <p className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-300">{message}</p>}
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">스캔 진행 상황</h2><p className="mt-1 text-sm text-slate-400">{progress ? statusLabel[progress.status] || progress.status : '스캔 기록 대기 중'}</p></div><div className="flex gap-2"><select value={runId} onChange={(e) => setRunId(e.target.value)} className="max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{runs.map((run) => <option key={run.id} value={run.id}>{run.employeeName || run.employeeId} · {new Date(run.startedAt).toLocaleString()}</option>)}</select>{progress?.status === 'InventoryReady' && <button onClick={startBackup} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium">백업 시작</button>}</div></div>
      <div className="grid gap-3 sm:grid-cols-5">{[['전체','total'],['대기','pending'],['완료','backedUp'],['실패','failed'],['제외','excluded']].map(([label,key]) => <div key={key} className="rounded-xl bg-slate-950/60 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{progress?.[key] || 0}</p></div>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); loadInventory(); }} className="flex flex-wrap gap-2"><label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><FiSearch/><input value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="파일 경로 검색" className="w-full bg-transparent text-sm outline-none"/></label><select value={inventoryStatus} onChange={(e) => setInventoryStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="">전체 상태</option><option value="Pending">대기</option><option value="BackedUp">완료</option><option value="Failed">실패</option><option value="Excluded">제외</option></select><button className="rounded-lg bg-blue-600 px-5 py-2">검색</button></form>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-slate-950 text-xs text-slate-500"><tr><th className="px-4 py-3">파일 경로</th><th className="px-4 py-3">크기</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">정책</th></tr></thead><tbody className="divide-y divide-slate-800">{inventory.map((item) => <tr key={item.id}><td className="max-w-3xl break-all px-4 py-3 font-mono text-xs">{item.path}</td><td className="whitespace-nowrap px-4 py-3">{formatBytes(item.sizeBytes)}</td><td className="px-4 py-3">{statusLabel[item.status] || item.status}</td><td className="whitespace-nowrap px-4 py-3"><button onClick={() => setRule(item, 'Include')} className="mr-2 rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">화이트</button><button onClick={() => setRule(item, 'Exclude')} className="rounded bg-rose-500/15 px-2 py-1 text-xs text-rose-400">블랙</button></td></tr>)}</tbody></table>{!inventory.length && <p className="p-8 text-center text-slate-500">등록된 파일 목록이 없습니다.</p>}</div>
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">완료된 백업 버전</h2><form onSubmit={(e) => { e.preventDefault(); loadArchive(); }} className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="직원, 장치, 원본 경로 검색" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/><button className="rounded-lg bg-blue-600 px-5 py-2">검색</button></form><div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs text-slate-500"><tr><th className="px-4 py-3">원본 경로</th><th className="px-4 py-3">직원</th><th className="px-4 py-3">버전</th><th className="px-4 py-3">최근 백업</th></tr></thead><tbody className="divide-y divide-slate-800">{files.map((file) => <tr key={file.id} onClick={() => openDetail(file.id)} className="cursor-pointer hover:bg-slate-800/50"><td className="break-all px-4 py-3 font-mono text-xs">{file.originalPath}</td><td className="px-4 py-3">{file.employeeName}</td><td className="px-4 py-3">{file.versionCount}</td><td className="px-4 py-3">{new Date(file.lastBackedUpAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>
  </div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelected(null)}><section className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}><div className="flex justify-between"><div><p className="flex items-center gap-2 text-blue-400"><FiArchive/>버전 기록</p><h2 className="mt-2 break-all font-mono text-sm">{selected.originalPath}</h2></div><button onClick={() => setSelected(null)}><FiX/></button></div><div className="mt-5 space-y-3">{newestVersionsFirst(selected.versions).map((version) => <article key={version.id} className="rounded-xl bg-slate-950/60 p-4"><div className="flex justify-between"><span>{new Date(version.uploadedAt).toLocaleString()} · {formatBytes(version.plainSizeBytes)}</span><button onClick={() => restore(version.id)} className="rounded bg-blue-600 px-3 py-1 text-xs">복원</button></div><p className="mt-2 break-all font-mono text-xs text-slate-500">SHA-256 {version.contentHash}</p></article>)}</div></section></div>}</div>;
}
