import React, { useState, useEffect } from "react";
import request from "../Actions/request";
import ProjectCard from "../Components/ProjectCard";
import { 
  FaTachometerAlt, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaPlay,
  FaSignOutAlt,
  FaClock,
  FaStop
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { native } from "../native";

const Dashboard = () => {
  const [userId, setUserId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  // Fetch user ID from local storage
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const current = await request.get("/attendance/current");
        setAttendance(current || null);
        if (current) {
          await native.startAttendanceMonitoring(localStorage.getItem("token"));
        }
      } catch (err) {
        console.error("Failed to load attendance:", err);
      }
    };
    loadAttendance();
  }, []);

  // Fetch projects when userId is available
  useEffect(() => {
    if (!userId) return;

    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await request.get(`/project/employee/${userId}/project`);
        setProjects(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
        setError("Failed to fetch projects. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [userId]);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
  };

  const handleClockIn = async () => {
    try {
      setAttendanceBusy(true);
      const current = await request.post("/attendance/clock-in", {});
      setAttendance(current);
      await native.startAttendanceMonitoring(localStorage.getItem("token"));
    } catch (err) {
      console.error("Failed to clock in:", err);
      alert("출근 처리를 완료하지 못했습니다.");
    } finally {
      setAttendanceBusy(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setAttendanceBusy(true);
      await request.post("/attendance/clock-out", {});
      await native.stopMonitoring();
      setAttendance(null);
    } catch (err) {
      console.error("Failed to clock out:", err);
      alert("퇴근 처리를 완료하지 못했습니다.");
    } finally {
      setAttendanceBusy(false);
    }
  };

  const formatElapsed = (startedAt) => {
    const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleStartSession = async () => {
    if (!selectedProjectId) {
      alert("Please select a project to start the session.");
      return;
    }
    if (!attendance) {
      alert("먼저 출근 시작 버튼을 눌러주세요.");
      return;
    }
  
    try {
      // Start the session
      const response = await request.post("/session/start", {
        projectId: String(selectedProjectId),
      });
      console.log("Session start response:", response);
  
      // Fetch screenshot interval
      const intervalRes = await request.get(
        `/project/${selectedProjectId}/employee/${userId}/screenshot-interval`
      );
      const interval = intervalRes?.screenshotInterval;
      const intervalToMilliseconds = (value) => {
        if (!value) return 10 * 60 * 1000;
        const [hours, minutes, seconds] = value.split(":").map(Number);
        const result = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
        return Number.isFinite(result) && result > 0 ? result : 10 * 60 * 1000;
      };

      const intervalMs = intervalToMilliseconds(interval);
      console.log("Screenshot interval in ms:", intervalMs);
      await native.startMonitoring(localStorage.getItem("token"), intervalMs);
  
      // Navigate to the session started screen
      navigate(`/sessionStarted?projectId=${selectedProjectId}`);
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    }
  };
  
  

  const handleLogout = async () => {
    await native.stopMonitoring().catch(console.error);
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logout */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold flex items-center">
            <FaTachometerAlt className="mr-3 text-blue-500" />
            Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <FaSignOutAlt className="mr-2" />
            Logout
          </button>
        </div>

        <p className="text-lg text-gray-400 mb-8">
          출근 상태와 오늘의 근무 시간을 확인하고 담당 프로젝트를 시작하세요.
        </p>

        <section className="mb-8 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center text-gray-400">
                <FaClock className="mr-2 text-blue-400" />
                오늘의 출퇴근
              </div>
              {attendance ? (
                <>
                  <p className="text-sm text-green-400">근무 중</p>
                  <p className="mt-1 font-mono text-5xl font-bold tracking-tight">
                    {formatElapsed(attendance.clockInAt)}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    출근 {new Date(attendance.clockInAt).toLocaleTimeString()}
                    <span className="mx-2">·</span>
                    누적 유휴 {attendance.totalIdleDuration || "00:00:00"}
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
              <button
                onClick={handleClockOut}
                disabled={attendanceBusy}
                className="flex items-center justify-center rounded-xl bg-red-600 px-7 py-4 text-lg font-semibold transition hover:bg-red-700 disabled:opacity-60"
              >
                <FaStop className="mr-3" /> 퇴근
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={attendanceBusy}
                className="flex items-center justify-center rounded-xl bg-green-600 px-7 py-4 text-lg font-semibold transition hover:bg-green-700 disabled:opacity-60"
              >
                <FaPlay className="mr-3" /> 출근 시작
              </button>
            )}
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <FaSpinner className="animate-spin mr-3 text-blue-500 text-2xl" />
            <p className="text-gray-400 text-lg">Loading projects...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center p-8">
            <FaExclamationTriangle className="mr-3 text-red-500 text-2xl" />
            <p className="text-red-500 text-lg">{error}</p>
          </div>
        )}

        {/* Project List */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelected={selectedProjectId === project.id}
                onSelect={() => handleSelectProject(project.id)}
              />
            ))}
          </div>
        )}

        {/* Start Session Button */}
        {!loading && !error && (
          <div className="fixed bottom-8 right-8">
            <button
              onClick={handleStartSession}
              disabled={!selectedProjectId || !attendance}
              className={`flex items-center px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                selectedProjectId && attendance
                  ? "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              <FaPlay className="mr-3" />
              프로젝트 업무 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
