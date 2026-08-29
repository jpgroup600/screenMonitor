// src/Pages/Dashboard.jsx
import React from 'react';
import Users from "../Components/Dashboard/Users";

export default function Dashboard() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <header className="flex items-center gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <div className="flex-grow h-px bg-gradient-to-r from-blue-500/20 to-transparent" />
        </header>
        <Users />
      </div>
    </div>
  );
}