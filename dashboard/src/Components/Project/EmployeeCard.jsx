// src/Components/EmployeeCard.jsx
import React from 'react';

const EmployeeCard = ({ employee, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(employee)}
      className={`border rounded-lg p-4 shadow-md cursor-pointer transition transform hover:scale-105 
        ${isSelected ? 'bg-teal-600 text-white' : 'bg-white text-gray-800'}`}
    >
      <h3 className="text-xl font-semibold mb-1">{employee.fullName}</h3>
      <p className="text-sm mb-1">{employee.email}</p>
      <p className="text-sm mb-1">Role: {employee.role}</p>
      <p className="text-sm">Designation: {employee.designation}</p>
    </div>
  );
};

export default EmployeeCard;
