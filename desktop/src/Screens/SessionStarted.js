import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import request from "../Actions/request";
import { FaStop } from "react-icons/fa";

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
      // Optionally, navigate back to the dashboard after ending the session.
      navigate("/");
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("Failed to end session. Please try again.");
    }
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Session Started</h1>
      <p className="text-lg mb-8">Your session for project ID: {projectId} is active.</p>
      <button
        onClick={handleEndSession}
        className="flex items-center px-8 py-3 rounded-lg text-lg font-semibold bg-red-600 hover:bg-red-700 transition-all duration-300"
      >
        <FaStop className="mr-3" />
        End Session
      </button>
    </div>
  );
};

export default SessionStarted;
