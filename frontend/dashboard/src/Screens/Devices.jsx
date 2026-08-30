import { useEffect, useMemo, useState } from 'react';
import { FiCpu, FiRefreshCw, FiSearch, FiShield, FiWifi, FiWifiOff } from 'react-icons/fi';
import request from '../Actions/request';
import { isDeviceOnline } from '../deviceStatus';
import SecurityPolicyModal from '../Components/SecurityPolicyModal';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');
  const [policyDevice, setPolicyDevice] = useState(null);

  const load = async () => {
    try {
      setError('');
      setDevices(await request.get('/devices'));
    } catch (loadError) {
      console.error('Failed to load devices:', loadError);
      setError('장치 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return devices;
    return devices.filter((device) => [device.employeeName, device.name, device.id]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [devices, search]);

  const changeStatus = async (device) => {
    const status = device.status === 'Blocked' ? 'Active' : 'Blocked';
    try {
      setUpdating(device.id);
      await request.put(`/devices/${device.id}/status`, { status });
      await load();
    } catch (updateError) {
      console.error('Failed to update device:', updateError);
      setError('장치 상태를 변경하지 못했습니다.');
    } finally {
      setUpdating('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-400">COMPANY DEVICES</p>
            <h1 className="mt-1 text-3xl font-bold">장치 관리</h1>
            <p className="mt-2 text-sm text-slate-400">직원 PC의 접속 상태를 확인하고 장치를 차단하거나 해제합니다.</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-blue-400 hover:bg-slate-700">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Summary label="전체 장치" value={devices.length} icon={FiCpu} />
          <Summary label="온라인" value={devices.filter((device) => isDeviceOnline(device.lastSeenAt) && device.status !== 'Blocked').length} icon={FiWifi} color="text-emerald-400" />
          <Summary label="차단" value={devices.filter((device) => device.status === 'Blocked').length} icon={FiShield} color="text-rose-400" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="font-semibold">등록 장치</h2>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
              <FiSearch className="text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원·PC·DeviceId 검색" className="w-60 bg-transparent text-sm outline-none" />
            </label>
          </div>
          {error && <div className="p-8 text-center text-rose-400">{error}</div>}
          {!error && loading && <div className="p-12 text-center text-slate-400">장치 목록을 불러오는 중입니다...</div>}
          {!error && !loading && rows.length === 0 && <div className="p-12 text-center text-slate-500">등록된 장치가 없습니다.</div>}
          {!error && !loading && rows.length > 0 && (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">직원 / 장치</th><th className="px-5 py-4">연결</th><th className="px-5 py-4">에이전트</th><th className="px-5 py-4">운영체제</th><th className="px-5 py-4">마지막 접속</th><th className="px-5 py-4">관리</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{rows.map((device) => {
                const online = isDeviceOnline(device.lastSeenAt) && device.status !== 'Blocked';
                return <tr key={device.id} className="hover:bg-slate-800/50">
                  <td className="px-5 py-4"><p className="font-medium">{device.employeeName || device.employeeId}</p><p className="text-xs text-slate-400">{device.name}</p><p className="font-mono text-xs text-slate-600">{device.id}</p></td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>{online ? <FiWifi /> : <FiWifiOff />}{online ? '온라인' : '오프라인'}</span></td>
                  <td className="px-5 py-4"><p className={device.monitoringState === 'Running' ? 'text-emerald-400' : 'text-amber-300'}>{device.monitoringState || 'Unknown'}</p><p className="text-xs text-slate-500">v{device.agentVersion || '?'} · {device.agentMode || 'UserSession'}</p>{device.pendingQueueItems > 0 && <p className="text-xs text-amber-400">전송 대기 {device.pendingQueueItems}건</p>}</td>
                  <td className="max-w-sm truncate px-5 py-4 text-slate-400" title={device.operatingSystem}>{device.operatingSystem}</td>
                  <td className="whitespace-nowrap px-5 py-4">{new Date(device.lastSeenAt).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-5 py-4"><button onClick={() => setPolicyDevice(device)} className="mr-2 rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-700">정책 설정</button><button disabled={updating === device.id} onClick={() => changeStatus(device)} className={`rounded-lg px-4 py-2 font-medium disabled:opacity-50 ${device.status === 'Blocked' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{device.status === 'Blocked' ? '차단 해제' : '차단'}</button></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
      </div>
      {policyDevice && (
        <SecurityPolicyModal device={policyDevice} onClose={() => setPolicyDevice(null)} />
      )}
    </div>
  );
}

function Summary({ label, value, icon: Icon, color = 'text-blue-400' }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-400">{label}</p><Icon className={color} /></div><p className="mt-3 text-3xl font-bold">{value}</p></div>;
}
