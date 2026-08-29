import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import request from "../Actions/request";
import { FaSignOutAlt, FaStop } from "react-icons/fa";
import { native } from "../native";

const SessionStarted = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get("projectId");

  const handleEndSession = async () => {
    try {
      const endpoint = `/session/end`;
      const response = await request.post(endpoint, { projectId: String(projectId) });
      console.log("Session end response:", response);
      await request.post("/attendance/resume-monitoring", {});
      await native.stopMonitoring();
      await native.startAttendanceMonitoring(localStorage.getItem("token"));
      navigate("/");
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("프로젝트 분류 종료에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleClockOut = async () => {
    try {
      await request.post("/attendance/clock-out", {});
      await native.stopMonitoring();
      navigate("/");
    } catch (error) {
      console.error("Failed to clock out:", error);
      alert("퇴근 처리에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">프로젝트 기록 중</h1>
      <p className="text-lg mb-2">프로젝트 ID: {projectId}</p>
      <p className="text-gray-400 mb-8">프로젝트 분류를 끝내도 출근 모니터링은 계속됩니다.</p>
      <div className="flex gap-4">
        <button onClick={handleEndSession} className="flex items-center px-8 py-3 rounded-lg text-lg font-semibold bg-blue-600 hover:bg-blue-700">
          <FaStop className="mr-3" /> 프로젝트 분류 종료
        </button>
        <button onClick={handleClockOut} className="flex items-center px-8 py-3 rounded-lg text-lg font-semibold bg-red-600 hover:bg-red-700">
          <FaSignOutAlt className="mr-3" /> 퇴근
        </button>
      </div>
    </div>
  );
};

export default SessionStarted;
