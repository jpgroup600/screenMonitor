import React, { useState, useEffect } from "react";
import request from "../Actions/request";
import ProjectCard from "../Components/ProjectCard";
import { 
  FaTachometerAlt, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaPlay,
  FaSignOutAlt 
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [userId, setUserId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const navigate = useNavigate();

  // Fetch user ID from local storage
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
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

  // Track user activity
  useEffect(() => {
    const handleUserActivity = () => {
      if (window.electronAPI?.userActivity) {
        window.electronAPI.userActivity();
      }
    };

    document.addEventListener("mousemove", handleUserActivity);
    document.addEventListener("keydown", handleUserActivity);

    return () => {
      document.removeEventListener("mousemove", handleUserActivity);
      document.removeEventListener("keydown", handleUserActivity);
    };
  }, []);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
  };

  const handleStartSession = async () => {
    if (!selectedProjectId) {
      alert("Please select a project to start the session.");
      return;
    }
    try {
      const response = await request.post('/session/start', { 
        projectId: String(selectedProjectId) 
      });
      console.log("Session start response:", response);

      if (window.electronAPI?.sessionStart) {
        window.electronAPI.sessionStart();
      }

      navigate(`/sessionStarted?projectId=${selectedProjectId}`);
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    
    if (window.electronAPI?.logout) {
      window.electronAPI.logout();
    }
    
    navigate("/login");
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
          Welcome to the dashboard! Select a project to start your session.
        </p>

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
              disabled={!selectedProjectId}
              className={`flex items-center px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                selectedProjectId
                  ? "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              <FaPlay className="mr-3" />
              Start Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;