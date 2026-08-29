import React, { useEffect, useState } from "react";
import request from "../Actions/request";
import ProjectCard from "../Components/ProjectCard";
import { FaClock, FaExclamationTriangle, FaPlay, FaSignOutAlt, FaSpinner, FaStop, FaTachometerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { native } from "../native";

const DEFAULT_INTERVAL = 10 * 60 * 1000;

const Dashboard = () => {
  const [userId, setUserId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    setUserId(localStorage.getItem("userId"));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const current = await request.get("/attendance/current");
        setAttendance(current || null);
        if (current) {
          await request.post("/attendance/resume-monitoring", {});
          await native.startAttendanceMonitoring(localStorage.getItem("token"));
        }
      } catch (err) { console.error("Failed to load attendance:", err); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        setLoading(true);
        setProjects(await request.get(`/project/employee/${userId}/project`));
        setError(null);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
        setError("프로젝트 목록을 불러오지 못했습니다.");
      } finally { setLoading(false); }
    };
    load();
  }, [userId]);

  const clockIn = async () => {
    try {
      setBusy(true);
      setAttendance(await request.post("/attendance/clock-in", {}));
      await native.startAttendanceMonitoring(localStorage.getItem("token"));
    } catch (err) {
      console.error(err);
      alert("출근 처리를 완료하지 못했습니다.");
    } finally { setBusy(false); }
  };

  const clockOut = async () => {
    try {
      setBusy(true);
      await request.post("/attendance/clock-out", {});
      await native.stopMonitoring();
      setAttendance(null);
    } catch (err) {
      console.error(err);
      alert("퇴근 처리를 완료하지 못했습니다.");
    } finally { setBusy(false); }
  };

  const elapsed = (startedAt) => {
    const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((value) => String(value).padStart(2, "0")).join(":");
  };

  const intervalMs = (value) => {
    if (!value) return DEFAULT_INTERVAL;
    const [hours, minutes, seconds] = value.split(":").map(Number);
    const result = (hours * 3600 + minutes * 60 + seconds) * 1000;
    return Number.isFinite(result) && result > 0 ? result : DEFAULT_INTERVAL;
  };

  const switchProject = async () => {
    if (!selectedProjectId) return alert("시간을 분류할 프로젝트를 선택해 주세요.");
    if (!attendance) return alert("먼저 출근 시작 버튼을 눌러 주세요.");
    try {
      await request.post("/session/start", { projectId: String(selectedProjectId) });
      const config = await request
        .get(`/project/${selectedProjectId}/employee/${userId}/screenshot-interval`)
        .catch((err) => {
          console.warn("Using default screenshot interval:", err);
          return null;
        });
      await native.startMonitoring(localStorage.getItem("token"), intervalMs(config?.screenshotInterval));
      navigate(`/sessionStarted?projectId=${selectedProjectId}`);
    } catch (err) {
      console.error(err);
      alert("프로젝트 시간 분류를 시작하지 못했습니다.");
    }
  };

  const logout = async () => {
    if (attendance) await request.post("/attendance/clock-out", {}).catch(console.error);
    await native.stopMonitoring().catch(console.error);
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold flex items-center"><FaTachometerAlt className="mr-3 text-blue-500" />근무 현황</h1>
          <button onClick={logout} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"><FaSignOutAlt className="mr-2" />로그아웃</button>
        </div>
        <p className="text-lg text-gray-400 mb-8">출근하면 화면 캡처, 활성 프로그램, 유휴 시간이 자동 기록됩니다. 프로젝트 선택은 근무 시간 분류용 선택 사항입니다.</p>

        <section className="mb-8 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center text-gray-400"><FaClock className="mr-2 text-blue-400" />오늘의 출퇴근</div>
              {attendance ? <>
                <p className="text-sm text-green-400">근무 중 · 모니터링 활성</p>
                <p className="mt-1 font-mono text-5xl font-bold tracking-tight">{elapsed(attendance.clockInAt)}</p>
                <p className="mt-2 text-sm text-gray-400">출근 {new Date(attendance.clockInAt).toLocaleTimeString()}<span className="mx-2">·</span>누적 유휴 {attendance.totalIdleDuration || "00:00:00"}</p>
              </> : <><p className="text-sm text-gray-400">아직 출근 전입니다.</p><p className="mt-1 text-3xl font-semibold">출근 준비</p></>}
            </div>
            {attendance
              ? <button onClick={clockOut} disabled={busy} className="flex items-center rounded-xl bg-red-600 px-7 py-4 text-lg font-semibold hover:bg-red-700 disabled:opacity-60"><FaStop className="mr-3" />퇴근</button>
              : <button onClick={clockIn} disabled={busy} className="flex items-center rounded-xl bg-green-600 px-7 py-4 text-lg font-semibold hover:bg-green-700 disabled:opacity-60"><FaPlay className="mr-3" />출근 시작</button>}
          </div>
        </section>

        {loading && <div className="flex items-center justify-center p-8"><FaSpinner className="animate-spin mr-3 text-blue-500 text-2xl" /><p className="text-gray-400 text-lg">프로젝트 불러오는 중...</p></div>}
        {error && <div className="flex items-center justify-center p-8"><FaExclamationTriangle className="mr-3 text-red-500 text-2xl" /><p className="text-red-500 text-lg">{error}</p></div>}
        {!loading && !error && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map((project) => <ProjectCard key={project.id} project={project} isSelected={selectedProjectId === project.id} onSelect={() => setSelectedProjectId(project.id)} />)}
        </div>}
        {!loading && !error && <div className="fixed bottom-8 right-8">
          <button onClick={switchProject} disabled={!selectedProjectId || !attendance} className={`flex items-center px-8 py-3 rounded-lg text-lg font-semibold ${selectedProjectId && attendance ? "bg-blue-600 hover:bg-blue-700 shadow-lg" : "bg-gray-600 cursor-not-allowed"}`}><FaPlay className="mr-3" />이 프로젝트로 시간 분류</button>
        </div>}
      </div>
    </div>
  );
};

export default Dashboard;
