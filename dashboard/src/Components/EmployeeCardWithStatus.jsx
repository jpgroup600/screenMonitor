import React from 'react';

export default function EmployeeCardWithStatus({ employee, isOnline }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-md hover:shadow-xl transition-transform duration-300 hover:scale-105">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">{employee.fullName}</h2>
        {/* Online status indicator */}
        <div
          className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}
          title={isOnline ? 'Online' : 'Offline'}
        ></div>
      </div>
      <p className="text-sm text-gray-400">{employee.email}</p>
      <p className="text-sm text-gray-400">Role: {employee.role}</p>
      <p className="text-sm text-gray-400">Designation: {employee.designation}</p>
    </div>
  );
}
