import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmployeeCardSession({ employee, isOnline, projectId }) {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  console.log(`Recent Screenshot: ${JSON.stringify(employee)}`)
  const handleViewSessions = () => {
    navigate(`/sessions/${employee.id}/${projectId}`);
  };

  return (
    <div className="relative">
      <button 
        onClick={handleViewSessions}
        onMouseEnter={() => setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
        className="relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 hover:border-blue-500/30 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-xl hover:shadow-2xl w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-300 truncate">
            {employee.fullName}
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-slate-500 to-slate-600'
              } border border-slate-600`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
        </div>
        
        <p className="text-slate-400 text-sm mb-2 truncate">{employee.email}</p>
        <p className="text-slate-400 text-sm">Role: {employee.role}</p>
        <p className="text-slate-400 text-sm truncate">Designation: {employee.designation}</p>
      </button>

      {showPopup && (
        <div 
          className="absolute left-full ml-4 top-0 w-96 z-50 bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
          onMouseEnter={() => setShowPopup(true)}
          onMouseLeave={() => setShowPopup(false)}
        >
          <div className="h-60 border-b border-slate-700 relative">
            {employee.recentScreenshot && (<img 
              src={`${import.meta.env.VITE_IMAGE_URL}/${employee.recentScreenshot.split(/[\\/]/).pop()}`} 
              alt="Recent activity" 
              className="w-full h-full object-contain bg-[#0F172A]"
            />)}
            <div className="absolute top-2 left-2 bg-slate-900/80 text-blue-300 text-xs px-2 py-1 rounded">
              Recent Activity
            </div>
          </div>
          
          <div className="p-4">
            <h4 className="text-blue-300 text-sm font-medium mb-3">Top Applications</h4>
            {employee.topApps?.length > 0 ? (
              <div className="space-y-3">
                {employee.topApps.map((app, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-slate-300 truncate flex-1">{app.name}</span>
                    <span className="text-slate-400 ml-4">{app.usage}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-2">No application data available</p>
            )}
          </div>

          <div className="p-4 border-t border-slate-700">
            <button 
              onClick={handleViewSessions}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm py-2 px-4 rounded-lg hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)] transition-all"
            >
              View Sessions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}