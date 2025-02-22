// EmployeeCardSession.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmployeeCardSession({ employee, isOnline, projectId }) {
  const navigate = useNavigate();

  const handleViewSessions = () => {
    navigate(`/sessions/${employee.id}/${projectId}`);
  };

  return (
    <button 
      onClick={handleViewSessions}
      className="bg-gray-800 rounded-xl p-6 shadow-md hover:shadow-xl transition-transform duration-300 hover:scale-105 w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">{employee.fullName}</h2>
        <div
          className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}
          title={isOnline ? 'Online' : 'Offline'}
        ></div>
      </div>
      <p className="text-sm text-gray-400">{employee.email}</p>
      <p className="text-sm text-gray-400">Role: {employee.role}</p>
      <p className="text-sm text-gray-400">Designation: {employee.designation}</p>
    </button>
  );
}