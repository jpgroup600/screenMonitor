// src/Components/Dashboard/Users.jsx
import React, { useContext, useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { OnlineUsersContext } from "../../Contexts/OnlineUsersContext";
import request from "../../Actions/request";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FiUsers, FiWifi, FiWifiOff, FiActivity, FiDatabase, FiCode } from "react-icons/fi";
import { FaSpinner } from "react-icons/fa";
import { StatsCard, SessionStats } from "./StatsCard";

ChartJS.register(ArcElement, Tooltip, Legend);

const Users = () => {
  const { onlineUserIds } = useContext(OnlineUsersContext);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesData, dashboardData] = await Promise.all([
          request.get("/admin/only-employees"),
          request.get("/admin/dashboard/stats")
        ]);
        setEmployees(employeesData);
        setStats(dashboardData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalEmployees = employees.length;
  const onlineCount = onlineUserIds.length;
  const offlineCount = totalEmployees - onlineCount;

  const chartData = {
    labels: ["Online", "Offline"],
    datasets: [{
      data: [onlineCount, Math.max(offlineCount, 0)],
      backgroundColor: ['#3b82f6', '#1e293b'],
      borderColor: ['#1e293b', '#1e293b'],
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#cbd5e1',
          font: {
            size: 14
          }
        }
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
        <StatsCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          icon={FiUsers}
        />
        <StatsCard 
          title="Total Projects" 
          value={stats.totalProjects} 
          icon={FiDatabase}
        />
        <StatsCard 
          title="Most Used App" 
          value={stats.mostUsedForegroundApp} 
          icon={FiCode}
        />
        <StatsCard 
          title="Active Sessions" 
          value={stats.activeSessions} 
          icon={FiActivity}
        />
      </div>

      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="w-full md:w-1/3 space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white">User Status</h2>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-2 sm:gap-3 text-emerald-400">
                <FiWifi className="text-xl sm:text-2xl" />
                <span className="text-sm sm:text-base font-medium">{onlineCount} Online</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
                <FiWifiOff className="text-xl sm:text-2xl" />
                <span className="text-sm sm:text-base font-medium">{offlineCount} Offline</span>
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 h-48 sm:h-64">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <SessionStats data={stats} />
    </div>
  );
};

export default Users;