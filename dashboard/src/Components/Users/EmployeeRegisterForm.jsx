// src/Components/EmployeeRegisterForm.jsx
import React, { useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { MdPerson, MdEmail, MdLock, MdWork, MdPhone } from 'react-icons/md';
import request from '../../Actions/request';

export default function EmployeeRegisterForm({ onClose, refreshEmployees }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const newEmployee = {
        fullName,
        email,
        password,
        designation,
        phoneNumber,
        role: 'Employee'
      };
      await request.post('/employee/register', newEmployee);
      // Refresh the employee list after successful registration.
      if (refreshEmployees) refreshEmployees();
      onClose();
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[#121222] rounded-xl p-8 w-full max-w-md shadow-xl relative">
        <h2 className="text-2xl font-bold mb-6 text-center">Register New Employee</h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdPerson className="text-teal-500" size={20} />
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>
          {/* Email Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdEmail className="text-teal-500" size={20} />
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="john@example.com"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>
          {/* Password Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdLock className="text-teal-500" size={20} />
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>
          {/* Designation Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdWork className="text-teal-500" size={20} />
            </span>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              required
              placeholder="Software Engineer"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>
          {/* Phone Number Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdPhone className="text-teal-500" size={20} />
            </span>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              placeholder="123-456-7890"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>
          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0068f7] hover:bg-[#005ac7] text-white px-4 py-2 rounded-lg transition duration-200 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" size={16} /> Registering...
                </>
              ) : (
                'Register'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
