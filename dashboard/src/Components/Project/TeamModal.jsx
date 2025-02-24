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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-8 w-full max-w-lg shadow-2xl border border-slate-700 relative">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Build Your Team
        </h2>
        
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mb-6 p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />

        {loadingEmployees ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <svg className="h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-h-96 overflow-y-auto p-2">
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

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800/50 hover:border-slate-500 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleAddEmployees}
            disabled={adding || selectedEmployees.length === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:hover:shadow-none"
          >
            {adding ? 'Adding...' : `Add Selected (${selectedEmployees.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
