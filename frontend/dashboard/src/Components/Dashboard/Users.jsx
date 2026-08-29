import React, { useContext, useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { useOnlineUsers } from "../../Contexts/OnlineUsersContext";
import request from "../../Actions/request";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FiUsers, FiWifi, FiWifiOff, FiActivity, FiDatabase, FiCode, FiZoomIn, FiCamera } from "react-icons/fi";
import { FaSpinner, FaTimes } from "react-icons/fa";
import { StatsCard, SessionStats } from "./StatsCard";

ChartJS.register(ArcElement, Tooltip, Legend);

const Users = () => {
  const { onlineUserIds,requestScreenshots } = useOnlineUsers();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [screenshots, setScreenshots] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loadingScreenshots, setLoadingScreenshots] = useState(true);
  const [isTakingScreenshots, setIsTakingScreenshots] = useState(false);

  // Fetch core data
  useEffect(() => {
    const fetchCoreData = async () => {
      try {
        const [employeesData, dashboardData] = await Promise.all([
          request.get("/admin/only-employees"),
          request.get("/admin/dashboard/stats")
        ]);
        setEmployees(employeesData);
        setStats(dashboardData);
      } catch (error) {
        console.error("Error fetching core data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoreData();
  }, []);

  // Fetch screenshots
  useEffect(() => {
    const fetchScreenshotsData = async () => {
      try {
        const screenshotsData = await request.post("/screenshots/recent-screenshots", {
          employeeIds: onlineUserIds
        });
        setScreenshots(screenshotsData);
      } catch (error) {
        console.error("Error fetching screenshots:", error);
      } finally {
        setLoadingScreenshots(false);
      }
    };

    if (onlineUserIds.length > 0) fetchScreenshotsData();
  }, [onlineUserIds]);

  const handleTakeAllScreenshots = async () => {
    if (!onlineUserIds.length || isTakingScreenshots) return;
  
    try {
      setIsTakingScreenshots(true);
      requestScreenshots()
      console.log("Screenshots requested from all online users.");
      
    } catch (error) {
      console.error('Error requesting screenshots:', error);
    } finally {
      setIsTakingScreenshots(false);
    }
  };

  const totalEmployees = employees.length;
  const onlineCount = onlineUserIds.length;
  const offlineCount = Math.max(totalEmployees - onlineCount, 0);

  const getImageUrl = (filePath) => {
    const filename = filePath.split(/[\\/]/).pop();
    return `${import.meta.env.VITE_IMAGE_URL}/${filename}`;
  };

  const chartData = {
    labels: ["Online", "Offline"],
    datasets: [{
      data: [onlineCount, offlineCount],
      backgroundColor: ['#3b82f6', '#1e293b'],
      borderColor: ['#1e293b', '#1e293b'],
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#cbd5e1', font: { size: 14 } }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#cbd5e1',
        bodyColor: '#e2e8f0',
        borderColor: '#1e293b',
        borderWidth: 1
      }
    },
    cutout: '65%',
    maintainAspectRatio: false
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsCard title="Total Employees" value={stats.totalEmployees} icon={FiUsers} />
        <StatsCard title="Total Projects" value={stats.totalProjects} icon={FiDatabase} />
        <StatsCard title="Most Used App" value={stats.mostUsedForegroundApp} icon={FiCode} />
        <StatsCard title="Active Sessions" value={stats.activeSessions} icon={FiActivity} />
      </div>

      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="w-full md:w-1/3 space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white">User Status</h2>
            <div className="space-y-1 sm:space-y-2">
              {employees.filter(e => onlineUserIds.includes(e.id)).map(user => (
                <div key={user.id} className="flex items-center gap-2 text-emerald-400">
                  <FiWifi className="text-xl" />
                  <span className="text-sm font-medium">
                    {user.name || user.employeeName || 'Unknown User'}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-slate-400">
                <FiWifiOff className="text-xl" />
                <span className="text-sm font-medium">{offlineCount} Offline</span>
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 h-48 sm:h-64">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-4 sm:p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-white">Recent Screenshots</h2>
          <button
            onClick={handleTakeAllScreenshots}
            disabled={isTakingScreenshots || onlineCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTakingScreenshots ? (
              <>
                <FaSpinner className="animate-spin" />
                <span className="hidden sm:inline">Capturing...</span>
              </>
            ) : (
              <>
                <FiCamera className="text-lg" />
                <span className="hidden sm:inline">Capture All</span>
              </>
            )}
          </button>
        </div>
        {loadingScreenshots ? (
          <div className="flex justify-center items-center h-32">
            <FaSpinner className="animate-spin text-2xl text-blue-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {screenshots.map((screenshot) => (
              <div 
                key={screenshot.timeTaken} 
                className="relative group cursor-zoom-in"
                onClick={() => setSelectedImage(screenshot)}
              >
                <div className="aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                  <img
                    src={getImageUrl(screenshot.imageFilePath)}
                    alt={`Screenshot - ${screenshot.employeeName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent p-2 flex items-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-white">
                    <p className="text-sm font-medium">{screenshot.employeeName}</p>
                    <p className="text-xs text-slate-300">
                      {new Date(screenshot.timeTaken).toLocaleString()}
                    </p>
                  </div>
                </div>
                <FiZoomIn className="absolute top-2 right-2 text-white bg-slate-900/50 p-1 rounded-lg" />
              </div>
            ))}
          </div>
        )}
        {screenshots.length === 0 && !loadingScreenshots && (
          <div className="text-center py-6 text-slate-400">
            No recent screenshots available
          </div>
        )}
      </div>

      <SessionStats data={stats} />

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-8 right-0 p-2 text-white hover:text-rose-400 transition-colors z-10"
            >
              <FaTimes className="text-2xl" />
            </button>
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
              <img
                src={getImageUrl(selectedImage.imageFilePath)}
                alt={`Fullscreen - ${selectedImage.employeeName}`}
                className="w-full h-full object-contain max-h-[80vh]"
              />
              <div className="p-4 bg-slate-900/80">
                <p className="text-white font-medium">{selectedImage.employeeName}</p>
                <p className="text-slate-300 text-sm">
                  {new Date(selectedImage.timeTaken).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;