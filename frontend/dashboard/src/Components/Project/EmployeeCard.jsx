import React from 'react';

const EmployeeCard = ({ employee, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(employee)}
      className={`group relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 cursor-pointer transition-all duration-300 hover:border-blue-500/30 hover:scale-[1.02] shadow-xl hover:shadow-2xl
        ${isSelected ? '!border-blue-500 !ring-2 !ring-blue-500/20' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-300 truncate">
          {employee.fullName}
        </h3>
        {isSelected && (
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-400" />
        )}
      </div>
      
      <p className="text-slate-400 text-sm mb-2 truncate">{employee.email}</p>
      <p className="text-slate-400 text-sm">Role: {employee.role}</p>
      <p className="text-slate-400 text-sm truncate">Designation: {employee.designation}</p>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
    </div>
  );
};

export default EmployeeCard;