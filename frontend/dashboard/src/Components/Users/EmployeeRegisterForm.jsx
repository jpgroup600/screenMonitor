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
      if (refreshEmployees) refreshEmployees();
      onClose();
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-8 w-full max-w-md shadow-2xl border border-slate-700 relative">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Register New Employee
        </h2>
        
        {error && <p className="text-rose-400 mb-4 text-center text-sm">{error}</p>}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdPerson className="text-blue-400" size={20} />
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Email Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdEmail className="text-blue-400" size={20} />
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="john@example.com"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdLock className="text-blue-400" size={20} />
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Designation Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdWork className="text-blue-400" size={20} />
            </span>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              required
              placeholder="Software Engineer"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Phone Number Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdPhone className="text-blue-400" size={20} />
            </span>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              placeholder="123-456-7890"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800/50 hover:border-slate-500 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center disabled:opacity-70"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" size={16} />
                  Registering...
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