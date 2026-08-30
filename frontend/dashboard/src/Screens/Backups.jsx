import { useEffect, useState } from 'react';
import { FiArchive, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import request from '../Actions/request';
import { formatBytes, newestVersionsFirst, restoreRequestPayload } from '../backupFile';

export default function Backups() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');

  const load = async (keyword = search) => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ take: '500' });
      if (keyword.trim()) query.set('search', keyword.trim());
      setFiles(await request.get(`/backups?${query}`));
    } catch (loadError) {
      console.error(loadError);
      setError('백업 파일을 불러오지 못했습니다.');
    } finally { setLoading(false); }
  };

  const openDetail = async (id) => {
    try { setSelected(await request.get(`/backups/${id}`)); }
    catch (loadError) { console.error(loadError); setError('백업 버전을 불러오지 못했습니다.'); }
  };

  const requestRestore = async (versionId) => {
    try {
      setRestoreMessage('');
      await request.post('/backups/restore-requests', restoreRequestPayload(versionId));
      setRestoreMessage('복원 요청을 보냈습니다. 원본 PC가 온라인이면 자동으로 별도 복원 파일을 생성합니다.');
    } catch (requestError) {
      console.error(requestError);
      setRestoreMessage('복원 요청에 실패했습니다.');
    }
  };

  useEffect(() => { load(''); }, []);

  return <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-blue-400">BACKUP ARCHIVE</p><h1 className="mt-1 text-3xl font-bold">백업 파일</h1><p className="mt-2 text-sm text-slate-400">직원, 장치 또는 원본 경로로 백업 이력과 버전을 조회합니다.</p></div>
        <button onClick={() => load()} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>새로고침</button>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><FiSearch/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원, 장치, 파일 경로 검색" className="w-full bg-transparent text-sm outline-none"/></label>
        <button className="rounded-lg bg-blue-600 px-5 py-2 font-medium hover:bg-blue-500">검색</button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        {error && <div className="p-10 text-center text-rose-400">{error}</div>}
        {!error && loading && <div className="p-10 text-center text-slate-400">불러오는 중...</div>}
        {!error && !loading && files.length === 0 && <div className="p-10 text-center text-slate-500">백업된 파일이 없습니다.</div>}
        {!error && !loading && files.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950/80 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">원본 경로</th><th className="px-5 py-4">직원</th><th className="px-5 py-4">장치</th><th className="px-5 py-4">버전</th><th className="px-5 py-4">최근 크기</th><th className="px-5 py-4">최근 백업</th></tr></thead><tbody className="divide-y divide-slate-800">{files.map((file) => <tr key={file.id} onClick={() => openDetail(file.id)} className="cursor-pointer hover:bg-slate-800/50"><td className="max-w-xl break-all px-5 py-4 font-mono text-xs">{file.originalPath}</td><td className="px-5 py-4">{file.employeeName}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">{file.deviceId}</td><td className="px-5 py-4">{file.versionCount}</td><td className="px-5 py-4">{formatBytes(file.latestSizeBytes)}</td><td className="whitespace-nowrap px-5 py-4">{new Date(file.lastBackedUpAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setSelected(null)}><section className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-blue-400"><FiArchive/>버전 기록</div><h2 className="mt-2 break-all font-mono text-sm">{selected.originalPath}</h2><p className="mt-2 text-sm text-slate-400">{selected.employeeName} · {selected.deviceId}</p></div><button onClick={() => setSelected(null)} className="p-2 text-slate-400 hover:text-white"><FiX size={22}/></button></div><div className="mt-6 space-y-3">{newestVersionsFirst(selected.versions).map((version) => <article key={version.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{new Date(version.uploadedAt).toLocaleString()}</strong><div className="flex items-center gap-3"><span className="text-slate-400">{formatBytes(version.plainSizeBytes)}</span><button onClick={() => requestRestore(version.id)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium hover:bg-blue-500">복원</button></div></div><p className="mt-2 break-all font-mono text-xs text-slate-500">SHA-256 {version.contentHash}</p><p className="mt-1 text-xs text-slate-500">원본 수정: {new Date(version.sourceModifiedAt).toLocaleString()}</p></article>)}</div>{restoreMessage && <p className="mt-6 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-300">{restoreMessage}</p>}<p className="mt-3 text-xs text-slate-500">원본 파일은 덮어쓰지 않고 같은 폴더에 restored 파일로 생성됩니다.</p></section></div>}
  </div>;
}
