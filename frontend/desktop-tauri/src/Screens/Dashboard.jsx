import React, { useEffect, useState } from "react";
import { FaClock, FaPlay, FaSignOutAlt, FaStop, FaTachometerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import request from "../Actions/request";
import { native } from "../native";
import ProjectCard from "../Components/ProjectCard";

const Dashboard = () => {
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    request.get(`/project/employee/${userId}/project`)
      .then((items) => setProjects(items || []))
      .catch((err) => console.error("Failed to load assigned projects:", err))
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const current = await request.get("/attendance/current");
        setAttendance(current || null);
        if (current) {
          await request.post("/attendance/resume-monitoring", {});
          await native.startAttendanceMonitoring(localStorage.getItem("token"));
        }
      } catch (err) {
        console.error("Failed to load attendance:", err);
      } finally {
        setAttendanceLoaded(true);
      }
    };
    loadAttendance();
  }, []);

  useEffect(() => {
    if (!attendanceLoaded || attendance) return undefined;
    native.startAttendanceReminders().catch(console.error);
    return () => native.stopAttendanceReminders().catch(console.error);
  }, [attendanceLoaded, attendance]);

  const clockIn = async () => {
    try {
      setBusy(true);
      setAttendance(await request.post("/attendance/clock-in", {}));
      await native.startAttendanceMonitoring(localStorage.getItem("token"));
    } catch (err) {
      console.error(err);
      alert("출근 처리를 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
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
    } finally {
      setBusy(false);
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

  const elapsed = (startedAt) => {
    const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold flex items-center">
            <FaTachometerAlt className="mr-3 text-blue-500" />근무 현황
          </h1>
          <button onClick={logout} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">
            <FaSignOutAlt className="mr-2" />로그아웃
          </button>
        </div>

        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center text-gray-400">
                <FaClock className="mr-2 text-blue-400" />오늘의 출퇴근
              </div>
              {attendance ? (
                <>
                  <p className="text-sm text-green-400">근무 중</p>
                  <p className="mt-1 font-mono text-5xl font-bold tracking-tight">{elapsed(attendance.clockInAt)}</p>
                  <p className="mt-2 text-sm text-gray-400">
                    출근 {new Date(attendance.clockInAt).toLocaleTimeString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">아직 출근 전입니다.</p>
                  <p className="mt-1 text-3xl font-semibold">출근 준비</p>
                </>
              )}
            </div>

            {attendance ? (
              <button onClick={clockOut} disabled={busy} className="flex items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold hover:bg-red-700 disabled:opacity-60">
                <FaStop className="mr-3" />퇴근
              </button>
            ) : (
              <button onClick={clockIn} disabled={busy} className="flex items-center justify-center rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold hover:bg-green-700 disabled:opacity-60">
                <FaPlay className="mr-3" />출근 시작
              </button>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">내 배정 프로젝트</h2>
          </div>
          {projectsLoading ? (
            <p className="text-gray-400">프로젝트를 불러오는 중입니다...</p>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.id} project={project} readOnly />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-400">
              현재 배정된 프로젝트가 없습니다.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
