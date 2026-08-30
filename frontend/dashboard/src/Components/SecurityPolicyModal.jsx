import { useEffect, useState } from 'react';
import { FiSave, FiShield, FiX } from 'react-icons/fi';
import request from '../Actions/request';
import { securityPolicyModules, securityPolicyPayload, updateSecurityPolicy } from '../securityPolicy';

export default function SecurityPolicyModal({ device, onClose }) {
  const [policy, setPolicy] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request.get(`/security-policies/device/${device.id}`)
      .then(setPolicy)
      .catch((error) => { console.error(error); setMessage('보안 정책을 불러오지 못했습니다.'); });
  }, [device.id]);

  const save = async () => {
    try {
      setSaving(true); setMessage('');
      setPolicy(await request.put(`/security-policies/device/${device.id}`, securityPolicyPayload(policy)));
      setMessage('정책을 저장했으며 다음 정책 확인 주기부터 적용됩니다.');
    } catch (error) {
      console.error(error); setMessage('보안 정책을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
    <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-blue-400"><FiShield/>장치별 보안 정책</p><h2 className="mt-2 text-xl font-semibold">{device.employeeName || device.employeeId} · {device.name}</h2><p className="mt-1 font-mono text-xs text-slate-500">{device.id}</p></div><button onClick={onClose} aria-label="닫기"><FiX/></button></header>
      {message && <p className="mt-4 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-300">{message}</p>}
      {!policy ? <p className="py-12 text-center text-slate-400">정책을 불러오는 중입니다...</p> : <>
        <div className="mt-6 divide-y divide-slate-800 rounded-xl border border-slate-800">{securityPolicyModules.map(([key, label, description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 p-4"><span><span className="block font-medium">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span><input type="checkbox" className="h-5 w-5 accent-blue-500" checked={Boolean(policy[key])} onChange={(event) => setPolicy((current) => updateSecurityPolicy(current, key, event.target.checked))}/></label>)}</div>
        {policy.retentionEnabled && <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 p-4 sm:grid-cols-3">
          <PolicyNumber label="보존 기간(일)" value={policy.retentionDays} min={1} max={3650} onChange={(value) => setPolicy((current) => ({...current, retentionDays: value}))}/>
          <PolicyNumber label="장치 한도(GB)" value={Math.round(Number(policy.maxBackupBytes || 0) / 1024 ** 3)} min={1} max={10240} onChange={(value) => setPolicy((current) => ({...current, maxBackupBytes: value * 1024 ** 3}))}/>
          <PolicyNumber label="파일별 버전 수" value={policy.maxVersionsPerFile} min={1} max={1000} onChange={(value) => setPolicy((current) => ({...current, maxVersionsPerFile: value}))}/>
        </div>}
        {policy.resourceThrottlingEnabled && <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 p-4 sm:grid-cols-2">
          <PolicyNumber label="스캔 파일당 대기(ms)" value={policy.scanThrottleMilliseconds} min={0} max={1000} onChange={(value) => setPolicy((current) => ({...current, scanThrottleMilliseconds: value}))}/>
          <PolicyNumber label="일일 업로드 한도(GB)" value={Math.round(Number(policy.dailyUploadLimitBytes || 0) / 1024 ** 3)} min={1} max={10240} onChange={(value) => setPolicy((current) => ({...current, dailyUploadLimitBytes: value * 1024 ** 3}))}/>
        </div>}
        <p className="mt-4 text-xs text-amber-300">시스템 영역과 브라우저 인증정보 등 강제 제외 경로는 이 설정과 관계없이 수집되지 않습니다.</p>
        <div className="mt-6 flex justify-end"><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"><FiSave/>{saving ? '저장 중...' : '정책 저장'}</button></div>
      </>}
    </section>
  </div>;
}

function PolicyNumber({label, value, min, max, onChange}) {
  return <label className="text-sm text-slate-300"><span className="mb-2 block">{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"/></label>;
}
