// src/Components/Project/TeamModal.jsx
import React, { useState, useEffect } from 'react';
import request from '../../Actions/request';
import EmployeeCard from './EmployeeCard';

export default function TeamModal({ projectId, onClose, refreshProjectDetails }) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [adding, setAdding] = useState(false);

  // Fetch available employees from the backend
  useEffect(() => {
    async function fetchEmployees() {
      setLoadingEmployees(true);
      try {
        const data = await request.get('/admin/only-employees');
        setEmployees(data);
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  // Filter employees based on the search query
  const filteredEmployees = employees.filter((emp) =>
    emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleEmployeeSelection = (employee) => {
    if (selectedEmployees.some((e) => e.id === employee.id)) {
      setSelectedEmployees(selectedEmployees.filter((e) => e.id !== employee.id));
    } else {
      setSelectedEmployees([...selectedEmployees, employee]);
    }
  };

  const handleAddEmployees = async () => {
    if (selectedEmployees.length === 0) return;
    setAdding(true);
    try {
      // For each selected employee, add them to the project
      for (const employee of selectedEmployees) {
        await request.post(`/project/${projectId}/${employee.id}`);
      }
      // Refresh the project details in the parent component
      refreshProjectDetails();
      onClose();
    } catch (error) {
      console.error('Error adding employees:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[#121222] rounded-xl p-8 w-full max-w-lg shadow-xl relative">
        <h2 className="text-2xl font-bold mb-4 text-center">Build Your Team</h2>
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mb-4 p-2 rounded-lg bg-[#020617] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {loadingEmployees ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin">
              <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {filteredEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                isSelected={selectedEmployees.some((e) => e.id === employee.id)}
                onSelect={() => toggleEmployeeSelection(employee)}
              />
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleAddEmployees}
            disabled={adding || selectedEmployees.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
