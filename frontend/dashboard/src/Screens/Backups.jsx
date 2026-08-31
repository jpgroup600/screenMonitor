import { useCallback, useEffect, useState } from 'react';
import { FiArchive, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import request from '../Actions/request';
import { formatBytes, newestVersionsFirst, restoreRequestPayload } from '../backupFile';
import { selectedInventoryItems, toggleAllInventorySelection, toggleInventorySelection } from '../inventorySelection';
import { effectiveFolderRule, folderDisplayName, normalizeFolderSearch, splitExplicitRules } from '../folderPolicy';
import { canMoveToNextPage, INVENTORY_PAGE_SIZE, pageQuery } from '../pagination';
import { canConfirmInventoryPlan, canStartInventoryBackup, inventoryBackupButtonLabel, inventoryBackupPercent, inventoryHeartbeat } from '../inventoryProgress';

const statusLabel = { Scanning: '폴더 구조와 용량 스캔 중', Abandoned: '중단된 스캔', PolicyDraft: '백업 폴더 선택 중', PlanReady: '백업 계획 확정', BackingUp: '백업 진행 중', Completed: '완료', Discovered: '발견', Pending: '대기', BackedUp: '완료', Failed: '실패', Excluded: '제외', Unchanged: '변경 없음' };

function FolderPolicyRow({ folder, rules, editable = true, onFolderRule }) {
  const [expanded, setExpanded] = useState(false);
  const policy = effectiveFolderRule(folder.path, rules);
  return <tr><td className="px-4 py-3"><button type="button" onClick={() => setExpanded(!expanded)} className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-xs">{expanded ? '−' : '+'}</button><span style={{ paddingLeft: `${Math.min(folder.depth, 8) * 10}px` }} className="inline-block"><span className="font-medium">{folderDisplayName(folder)}</span>{expanded && <span className="block break-all font-mono text-xs text-slate-500">{folder.path}</span>}</span></td><td className="whitespace-nowrap px-4 py-3">{folder.fileCount}</td><td className="whitespace-nowrap px-4 py-3">{formatBytes(folder.sizeBytes)}</td><td className="px-4 py-3"><span className={policy.action === 'Exclude' ? 'text-rose-400' : 'text-emerald-400'}>{policy.action === 'Exclude' ? '백업 제외' : '백업 포함'}</span>{policy.inherited && <span className="ml-1 text-xs text-slate-500">(상위/기본)</span>}</td><td className="whitespace-nowrap px-4 py-3"><button disabled={!editable} onClick={() => onFolderRule(folder, 'Include')} className="mr-2 rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400 disabled:opacity-30">포함</button><button disabled={!editable} onClick={() => onFolderRule(folder, 'Exclude')} className="rounded bg-rose-500/15 px-2 py-1 text-xs text-rose-400 disabled:opacity-30">제외</button></td></tr>;
}

export default function Backups() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [progress, setProgress] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [folders, setFolders] = useState([]);
  const [folderSearch, setFolderSearch] = useState('');
  const [rules, setRules] = useState([]);
  const [folderPage, setFolderPage] = useState(0);
  const [filePage, setFilePage] = useState(0);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState(() => new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
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
    const page = pageQuery(filePage);
    const query = new URLSearchParams({ take: String(page.take), skip: String(page.skip) });
    if (inventorySearch.trim()) query.set('search', inventorySearch.trim());
    if (inventoryStatus) query.set('status', inventoryStatus);
    const [nextProgress, items] = await Promise.all([
      request.get(`/backups/inventory/runs/${runId}/progress`),
      request.get(`/backups/inventory/runs/${runId}/files?${query}`),
    ]);
    setProgress(nextProgress); setInventory(items || []);
  }, [runId, inventorySearch, inventoryStatus, filePage]);

  const loadFolders = useCallback(async () => {
    if (!runId) return;
    const run = runs.find((value) => value.id === runId);
    if (!run) return;
    const page = pageQuery(folderPage);
    const query = new URLSearchParams({ take: String(page.take), skip: String(page.skip) });
    const normalizedSearch = normalizeFolderSearch(folderSearch);
    if (normalizedSearch) query.set('search', normalizedSearch);
    const [nextFolders, nextRules] = await Promise.all([
      request.get(`/backups/inventory/runs/${runId}/folders?${query}`),
      request.get(`/backups/inventory/rules?deviceId=${encodeURIComponent(run.deviceId)}`),
    ]);
    setFolders(nextFolders || []); setRules(nextRules || []);
  }, [runId, runs, folderSearch, folderPage]);

  const loadArchive = useCallback(async () => {
    const query = new URLSearchParams({ take: '500' });
    if (search.trim()) query.set('search', search.trim());
    setFiles(await request.get(`/backups?${query}`));
  }, [search]);

  const refresh = useCallback(async () => {
    try { setLoading(true); setMessage(''); await loadRuns(); await Promise.all([loadInventory(), loadFolders(), loadArchive()]); }
    catch (error) { console.error(error); setMessage('백업 정보를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [loadRuns, loadInventory, loadFolders, loadArchive]);

  useEffect(() => { loadRuns().then(loadArchive).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadInventory(); const timer = window.setInterval(loadInventory, 5000); return () => window.clearInterval(timer); }, [loadInventory]);
  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { setSelectedInventoryIds(new Set()); }, [runId, inventorySearch, inventoryStatus, filePage]);
  useEffect(() => { setFolderPage(0); setFilePage(0); }, [runId]);

  const setRule = async (item, action) => {
    const run = runs.find((value) => value.id === runId);
    await request.put('/backups/inventory/rules', { deviceId: run.deviceId, path: item.path, action });
    setMessage(`${item.path} 경로를 ${action === 'Exclude' ? '블랙리스트' : '화이트리스트'}로 설정했습니다.`);
    await loadInventory();
  };
  const setFolderRule = async (folder, action) => {
    const run = runs.find((value) => value.id === runId);
    await request.put('/backups/inventory/rules', { deviceId: run.deviceId, path: folder.path, action });
    setMessage(`${folder.path} 폴더와 하위 항목을 ${action === 'Exclude' ? '백업 제외' : '백업 포함'}로 설정했습니다.`);
    await Promise.all([loadFolders(), loadInventory()]);
  };
  const removeRule = async (rule) => {
    if (!window.confirm(`${rule.path} 규칙을 삭제할까요? 삭제 후 상위 폴더 또는 기본 정책이 적용됩니다.`)) return;
    await request.delete(`/backups/inventory/rules/${rule.id}`);
    setMessage(`${rule.path} 직접 규칙을 삭제했습니다.`);
    await Promise.all([loadFolders(), loadInventory()]);
  };
  const selectedItems = selectedInventoryItems(selectedInventoryIds, inventory);
  const explicitRules = splitExplicitRules(rules);
  const scanHeartbeat = inventoryHeartbeat(progress?.lastProgressAt);
  const backupHeartbeat = inventoryHeartbeat(progress?.lastBackupActivityAt);
  const backupPercent = inventoryBackupPercent(progress);
  const allVisibleSelected = inventory.length > 0 && selectedItems.length === inventory.length;
  const setBulkRule = async (action) => {
    const run = runs.find((value) => value.id === runId);
    if (!run || selectedItems.length === 0) return;
    setBulkUpdating(true);
    try {
      const result = await request.put('/backups/inventory/rules/bulk', {
        deviceId: run.deviceId, paths: selectedItems.map((item) => item.path), action,
      });
      setMessage(`선택한 ${result.updated}개 경로를 ${action === 'Exclude' ? '블랙리스트' : '화이트리스트'}로 설정했습니다.`);
      setSelectedInventoryIds(new Set());
      await loadInventory();
    } catch (error) {
      console.error(error); setMessage('선택한 경로의 정책을 일괄 변경하지 못했습니다.');
    } finally { setBulkUpdating(false); }
  };
  const startBackup = async () => { await request.post(`/backups/inventory/runs/${runId}/start-backup`, {}); setMessage('순차 백업을 시작했습니다.'); await loadInventory(); };
  const confirmPlan = async () => { await request.post(`/backups/inventory/runs/${runId}/confirm-plan`, {}); setMessage('현재 폴더 정책으로 백업 계획을 확정했습니다.'); await loadInventory(); };
  const openDetail = async (id) => setSelected(await request.get(`/backups/${id}`));
  const restore = async (versionId) => { await request.post('/backups/restore-requests', restoreRequestPayload(versionId)); setMessage('원본 장치에 복원 요청을 보냈습니다.'); };

  return <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-blue-400">BACKUP INVENTORY</p><h1 className="mt-1 text-3xl font-bold">파일 목록 및 백업</h1><p className="mt-2 text-sm text-slate-400">전체 파일 목록은 수집하되, 실제 백업은 포함 목록에 지정한 폴더만 처리합니다.</p></div><button onClick={refresh} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>새로고침</button></header>
    {message && <p className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-300">{message}</p>}
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/50 p-3"><p className="text-sm text-slate-400">스캔 완료 후 폴더 정책을 설정하고 계획을 확정해야 백업을 시작할 수 있습니다.</p><button onClick={confirmPlan} disabled={!canConfirmInventoryPlan(progress)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">백업 계획 확정</button></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">스캔 진행 상황</h2><p className="mt-1 text-sm text-slate-400">{progress ? statusLabel[progress.status] || progress.status : '스캔 기록 대기 중'}</p></div><div className="flex gap-2"><select value={runId} onChange={(e) => setRunId(e.target.value)} className="max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{runs.map((run) => <option key={run.id} value={run.id}>{run.employeeName || run.employeeId} · {new Date(run.startedAt).toLocaleString()}</option>)}</select><button onClick={startBackup} disabled={!canStartInventoryBackup(progress)} title="스캔 중에도 지금까지 발견된 파일부터 백업할 수 있습니다." className="rounded-lg bg-emerald-600 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{inventoryBackupButtonLabel(progress)}</button></div></div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['전체','total'],['백업 대기','pending'],['완료','backedUp'],['변경 없음','unchanged'],['실패','failed'],['제외','excluded']].map(([label,key]) => <div key={key} className="rounded-xl bg-slate-950/60 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{progress?.[key] || 0}</p></div>)}</div>
      {progress?.backupRequested && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-emerald-300">백업 진행률</span><span>{backupPercent}% · {progress.backedUp || 0} / {(progress.pending || 0) + (progress.backedUp || 0) + (progress.failed || 0)}개</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${backupPercent}%` }}/></div><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>남은 파일 {progress.pending || 0}개</span><span>최근 처리: <strong className={backupHeartbeat.tone}>{backupHeartbeat.label}</strong>{progress.lastBackupActivityAt ? ` · ${new Date(progress.lastBackupActivityAt).toLocaleTimeString()}` : ''}</span></div></div>}
      {progress?.status === 'Scanning' && <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div><p className="text-xs text-slate-500">발견 파일</p><p className="mt-1 text-lg font-semibold">{progress.discoveredFiles || 0}</p></div><div><p className="text-xs text-slate-500">발견 용량</p><p className="mt-1 text-lg font-semibold">{formatBytes(progress.discoveredBytes || 0)}</p></div><div><p className="text-xs text-slate-500">건너뜀</p><p className="mt-1 text-lg font-semibold">{progress.skippedEntries || 0}</p></div><div><p className="text-xs text-slate-500">접근 불가</p><p className="mt-1 text-lg font-semibold">{progress.inaccessibleEntries || 0}</p></div><div><p className="text-xs text-slate-500">스캔 응답</p><p className={`mt-1 text-lg font-semibold ${scanHeartbeat.tone}`}>{scanHeartbeat.label}</p></div></div><p className="mt-3 break-all font-mono text-xs text-slate-400">현재 경로: {progress.currentPath || '스캔 시작 대기 중'}</p>{progress.lastProgressAt && <p className="mt-1 text-xs text-slate-500">마지막 스캔 업데이트: {new Date(progress.lastProgressAt).toLocaleString()}</p>}</div>}
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">폴더별 백업 정책</h3><p className="text-xs text-slate-500">상위 폴더 정책은 하위 전체에 적용되고, 더 구체적인 하위 정책이 우선합니다.</p></div><form onSubmit={(event) => { event.preventDefault(); setFolderPage(0); loadFolders(); }} className="flex gap-2"><input value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="바탕화면, 문서 또는 폴더 경로" className="min-w-72 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm">폴더 검색</button></form></div>
        <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-950 text-xs text-slate-500"><tr><th className="px-4 py-3">폴더 · 펼치기</th><th className="px-4 py-3">파일</th><th className="px-4 py-3">용량</th><th className="px-4 py-3">적용 정책</th><th className="px-4 py-3">설정</th></tr></thead><tbody className="divide-y divide-slate-800">{folders.map((folder) => <FolderPolicyRow key={folder.path} folder={folder} rules={rules} runId={runId} onFolderRule={setFolderRule} onFileRule={setRule}/>)}</tbody></table>{!folders.length && <p className="p-8 text-center text-slate-500">스캔된 폴더가 없습니다.</p>}</div><div className="flex items-center justify-end gap-3"><button disabled={folderPage === 0} onClick={() => setFolderPage((page) => Math.max(0, page - 1))} className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">이전</button><span className="text-sm text-slate-400">{folderPage + 1}페이지 · 최대 {INVENTORY_PAGE_SIZE}개</span><button disabled={!canMoveToNextPage(folders)} onClick={() => setFolderPage((page) => page + 1)} className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">다음</button></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-emerald-300">내 백업 포함 목록</h3><span className="text-xs text-slate-500">{explicitRules.included.length}개</span></div><div className="max-h-48 space-y-2 overflow-auto">{explicitRules.included.map((rule) => <div key={rule.id || rule.path} className="flex items-start justify-between gap-3 rounded-lg bg-slate-950/60 p-3"><div><p className="break-all font-mono text-xs">{rule.path}</p><p className="mt-1 text-xs text-slate-500">{new Date(rule.createdAt).toLocaleString()}</p></div><button onClick={() => removeRule(rule)} className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">삭제</button></div>)}{!explicitRules.included.length && <p className="text-sm text-slate-500">포함 폴더가 없어 실제 백업 대상이 없습니다. 위 폴더 목록에서 필요한 폴더를 포함하세요.</p>}</div></div><div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-rose-300">내 백업 제외 목록</h3><span className="text-xs text-slate-500">{explicitRules.excluded.length}개</span></div><div className="max-h-48 space-y-2 overflow-auto">{explicitRules.excluded.map((rule) => <div key={rule.id || rule.path} className="flex items-start justify-between gap-3 rounded-lg bg-slate-950/60 p-3"><div><p className="break-all font-mono text-xs">{rule.path}</p><p className="mt-1 text-xs text-slate-500">{new Date(rule.createdAt).toLocaleString()}</p></div><button onClick={() => removeRule(rule)} className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">삭제</button></div>)}{!explicitRules.excluded.length && <p className="text-sm text-slate-500">직접 지정한 제외 규칙이 없습니다.</p>}</div></div></section>
      <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer font-semibold">개별 파일 보기 및 예외 설정</summary><div className="mt-4 space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setFilePage(0); loadInventory(); }} className="flex flex-wrap gap-2"><label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><FiSearch/><input value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="파일 경로 검색" className="w-full bg-transparent text-sm outline-none"/></label><select value={inventoryStatus} onChange={(e) => { setInventoryStatus(e.target.value); setFilePage(0); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="">전체 상태</option><option value="Pending">대기</option><option value="BackedUp">완료</option><option value="Unchanged">변경 없음</option><option value="Failed">실패</option><option value="Excluded">제외</option></select><button className="rounded-lg bg-blue-600 px-5 py-2">검색</button></form>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"><span className="text-sm text-slate-400">{selectedItems.length}개 선택됨</span><div className="flex gap-2"><button type="button" disabled={!selectedItems.length || bulkUpdating} onClick={() => setBulkRule('Include')} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">선택 항목 화이트</button><button type="button" disabled={!selectedItems.length || bulkUpdating} onClick={() => setBulkRule('Exclude')} className="rounded bg-rose-600 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">선택 항목 블랙</button></div></div>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-slate-950 text-xs text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="현재 목록 전체 선택" checked={allVisibleSelected} onChange={(event) => setSelectedInventoryIds((current) => toggleAllInventorySelection(current, inventory, event.target.checked))}/></th><th className="px-4 py-3">파일 경로</th><th className="px-4 py-3">크기</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">정책</th></tr></thead><tbody className="divide-y divide-slate-800">{inventory.map((item) => <tr key={item.id} className={selectedInventoryIds.has(item.id) ? 'bg-blue-500/10' : ''}><td className="px-4 py-3"><input type="checkbox" aria-label={`${item.path} 선택`} checked={selectedInventoryIds.has(item.id)} onChange={(event) => setSelectedInventoryIds((current) => toggleInventorySelection(current, item.id, event.target.checked))}/></td><td className="max-w-3xl break-all px-4 py-3 font-mono text-xs">{item.path}</td><td className="whitespace-nowrap px-4 py-3">{formatBytes(item.sizeBytes)}</td><td className="px-4 py-3">{statusLabel[item.status] || item.status}</td><td className="whitespace-nowrap px-4 py-3"><button onClick={() => setRule(item, 'Include')} className="mr-2 rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">포함 예외</button><button onClick={() => setRule(item, 'Exclude')} className="rounded bg-rose-500/15 px-2 py-1 text-xs text-rose-400">제외 예외</button></td></tr>)}</tbody></table>{!inventory.length && <p className="p-8 text-center text-slate-500">등록된 파일 목록이 없습니다.</p>}</div>
      <div className="flex items-center justify-end gap-3"><button disabled={filePage === 0} onClick={() => setFilePage((page) => Math.max(0, page - 1))} className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">이전</button><span className="text-sm text-slate-400">{filePage + 1}페이지 · 최대 {INVENTORY_PAGE_SIZE}개</span><button disabled={!canMoveToNextPage(inventory)} onClick={() => setFilePage((page) => page + 1)} className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">다음</button></div>
      </div></details>
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">완료된 백업 버전</h2><form onSubmit={(e) => { e.preventDefault(); loadArchive(); }} className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="직원, 장치, 원본 경로 검색" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/><button className="rounded-lg bg-blue-600 px-5 py-2">검색</button></form><div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs text-slate-500"><tr><th className="px-4 py-3">원본 경로</th><th className="px-4 py-3">직원</th><th className="px-4 py-3">버전</th><th className="px-4 py-3">최근 백업</th></tr></thead><tbody className="divide-y divide-slate-800">{files.map((file) => <tr key={file.id} onClick={() => openDetail(file.id)} className="cursor-pointer hover:bg-slate-800/50"><td className="break-all px-4 py-3 font-mono text-xs">{file.originalPath}</td><td className="px-4 py-3">{file.employeeName}</td><td className="px-4 py-3">{file.versionCount}</td><td className="px-4 py-3">{new Date(file.lastBackedUpAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>
  </div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelected(null)}><section className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}><div className="flex justify-between"><div><p className="flex items-center gap-2 text-blue-400"><FiArchive/>버전 기록</p><h2 className="mt-2 break-all font-mono text-sm">{selected.originalPath}</h2></div><button onClick={() => setSelected(null)}><FiX/></button></div><div className="mt-5 space-y-3">{newestVersionsFirst(selected.versions).map((version) => <article key={version.id} className="rounded-xl bg-slate-950/60 p-4"><div className="flex justify-between"><span>{new Date(version.uploadedAt).toLocaleString()} · {formatBytes(version.plainSizeBytes)}</span><button onClick={() => restore(version.id)} className="rounded bg-blue-600 px-3 py-1 text-xs">복원</button></div><p className="mt-2 break-all font-mono text-xs text-slate-500">SHA-256 {version.contentHash}</p></article>)}</div></section></div>}</div>;
}
