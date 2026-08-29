import { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiCheckCircle, FiClock, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi';
import request from '../Actions/request';

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const duration = (value) => {
  if (!value) return '00:00:00';
  const main = String(value).split('.')[0];
  const parts = main.split(':');
  return parts.length === 3 ? parts.map((part) => part.padStart(2, '0')).join(':') : main;
};

const dateRange = (value) => {
  const from = new Date(`${value}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
};

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState({ summary: {}, records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const range = dateRange(selectedDate);
      const params = new URLSearchParams(range);
      if (status) params.set('status', status);
      const data = await request.get(`/attendance/admin?${params}`);
      setReport(data);
    } catch (err) {
      console.error('Failed to load attendance report:', err);
      setError('출퇴근 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedDate, status]);

  const records = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return report.records || [];
    return (report.records || []).filter((record) =>
      record.employeeName.toLowerCase().includes(keyword) ||
      record.employeeEmail.toLowerCase().includes(keyword)
    );
  }, [report.records, search]);

  const cards = [
    { label: '출근 기록', value: report.summary?.totalRecords || 0, icon: FiUsers, color: 'text-blue-400' },
    { label: '현재 근무 중', value: report.summary?.activeEmployees || 0, icon: FiActivity, color: 'text-emerald-400' },
    { label: '퇴근 완료', value: report.summary?.completedEmployees || 0, icon: FiCheckCircle, color: 'text-violet-400' },
    { label: '총 유휴 시간', value: duration(report.summary?.totalIdleDuration), icon: FiClock, color: 'text-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-400">EMPLOYEE ATTENDANCE</p>
            <h1 className="mt-1 text-3xl font-bold">출퇴근 관리</h1>
            <p className="mt-2 text-sm text-slate-400">직원별 출근·퇴근·유휴 시간을 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 outline-none focus:border-blue-500"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="">전체 상태</option>
              <option value="Active">근무 중</option>
              <option value="Complete">퇴근 완료</option>
            </select>
            <button onClick={load} className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-blue-400 hover:bg-slate-700" aria-label="새로고침">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{label}</p>
                <Icon className={`text-xl ${color}`} />
              </div>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">직원 근무 기록</h2>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
              <FiSearch className="text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
            </label>
          </div>

          {error && <div className="p-8 text-center text-rose-400">{error}</div>}
          {!error && loading && <div className="p-12 text-center text-slate-400">출퇴근 기록을 불러오는 중입니다...</div>}
          {!error && !loading && records.length === 0 && <div className="p-12 text-center text-slate-500">선택한 조건의 출퇴근 기록이 없습니다.</div>}
          {!error && !loading && records.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">직원</th>
                    <th className="px-5 py-4">상태</th>
                    <th className="px-5 py-4">출근</th>
                    <th className="px-5 py-4">퇴근</th>
                    <th className="px-5 py-4">근무 시간</th>
                    <th className="px-5 py-4">유휴 시간</th>
                    <th className="px-5 py-4">활동 시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-100">{record.employeeName}</p>
                        <p className="text-xs text-slate-500">{record.employeeEmail}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${record.status === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                          {record.status === 'Active' ? '근무 중' : '퇴근 완료'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">{new Date(record.clockInAt).toLocaleTimeString()}</td>
                      <td className="whitespace-nowrap px-5 py-4">{record.clockOutAt ? new Date(record.clockOutAt).toLocaleTimeString() : '-'}</td>
                      <td className="px-5 py-4 font-mono">{duration(record.workDuration)}</td>
                      <td className="px-5 py-4 font-mono text-amber-400">{duration(record.totalIdleDuration)}</td>
                      <td className="px-5 py-4 font-mono text-emerald-400">{duration(record.productiveDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
