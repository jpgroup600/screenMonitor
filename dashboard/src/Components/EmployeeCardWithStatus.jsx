import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmployeeCardWithStatus({ employee, isOnline }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/users/profile/${employee.id}`);
  };

  return (
    <div 
      onClick={handleClick}
      className="group relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 hover:border-blue-500/30 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-xl hover:shadow-2xl"
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
          ></div>
        </div>
      </div>
      
      <p className="text-slate-400 text-sm mb-2 truncate">{employee.email}</p>
      <p className="text-slate-400 text-sm">Role: {employee.role}</p>
      <p className="text-slate-400 text-sm truncate">Designation: {employee.designation}</p>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
    </div>
  );
}