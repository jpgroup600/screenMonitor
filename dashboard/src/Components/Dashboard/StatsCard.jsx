// src/Components/Dashboard/StatsCard.jsx
import React from 'react';
import { 
  FiActivity, 
  FiClock, 
  FiMonitor, 
} from 'react-icons/fi';

export const StatsCard = ({ title, value, icon: Icon }) => (
  <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-4 sm:p-6 shadow-2xl">
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="p-2 sm:p-3 bg-slate-800 rounded-lg text-blue-400">
        <Icon className="text-xl sm:text-2xl" />
      </div>
      <div>
        <h3 className="text-xs sm:text-sm text-slate-400 font-medium">{title}</h3>
        <p className="text-xl sm:text-2xl font-semibold text-white">
          {value || 'N/A'}
        </p>
      </div>
    </div>
  </div>
);

export const SessionStats = ({ data }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
    <StatsCard 
      title="Total Sessions" 
      value={data.totalSessions} 
      icon={FiClock}
    />
    <StatsCard 
      title="Active Sessions" 
      value={data.activeSessions} 
      icon={FiActivity}
    />
    <StatsCard 
      title="Total Screenshots" 
      value={data.totalScreenshots} 
      icon={FiMonitor}
    />
  </div>
);