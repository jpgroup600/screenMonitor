// src/Components/LogoutPopup.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogoutPopup({ onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Remove token and navigate to the login page
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[#121222] rounded-xl p-8 w-full max-w-sm shadow-xl">
        <h2 className="text-white text-2xl mb-4 text-center">Confirm Logout</h2>
        <p className="text-gray-300 mb-6 text-center">
          Are you sure you want to log out?
        </p>
        <div className="flex justify-around">
          <button 
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition duration-200"
          >
            Cancel
          </button>
          <button 
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
