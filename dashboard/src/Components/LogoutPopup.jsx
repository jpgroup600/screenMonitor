// src/Components/LogoutPopup.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogoutPopup({ onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem('token');
    
    // Force full page refresh to reset all states
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 w-full max-w-md mx-4 border border-slate-700 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Confirm Logout
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            Are you sure you want to sign out?
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-blue-500 transition-all duration-200"
          >
            Cancel
          </button>
          <button 
            onClick={handleLogout}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}