import React, { useState, useEffect, useContext } from "react";
import request from "../Actions/request";
import EmployeeCardWithStatus from "../Components/EmployeeCardWithStatus";
import EmployeeRegisterForm from "../Components/Users/EmployeeRegisterForm";
import { OnlineUsersContext } from "../Contexts/OnlineUsersContext";

export default function Users() {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  // Get online user IDs from context
  const { onlineUserIds } = useContext(OnlineUsersContext);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const data = await request.get("/admin/only-employees");
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((employee) =>
    employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Employees
        </h1>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all"
        >
          Sign Up New Employee
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Loading spinner */}
      {loadingEmployees && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin">
            <svg
              className="h-12 w-12 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      )}

      {/* No results */}
      {!loadingEmployees && filteredEmployees.length === 0 && (
        <p className="text-center text-slate-400 py-8">No employees found.</p>
      )}

      {/* Employee cards grid */}
      {!loadingEmployees && filteredEmployees.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredEmployees.map((employee) => (
            <EmployeeCardWithStatus
              key={employee.id}
              employee={employee}
              isOnline={onlineUserIds.includes(employee.id)}
            />
          ))}
        </div>
      )}

      {/* Registration modal */}
      {isRegisterModalOpen && (
        <EmployeeRegisterForm
          onClose={() => setIsRegisterModalOpen(false)}
          refreshEmployees={fetchEmployees}
        />
      )}
    </div>
  );
}
