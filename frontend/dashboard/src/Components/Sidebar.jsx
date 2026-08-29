// src/Components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FiGrid, 
  FiFolder, 
  FiUsers, 
  FiLogOut,
  FiX,
  FiMenu 
} from 'react-icons/fi';
import LogoutPopup from './LogoutPopup';

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen }) {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const location = useLocation();

  const menuItems = [
    { title: 'Dashboard', icon: <FiGrid />, link: '/' },
    { title: 'Projects', icon: <FiFolder />, link: '/projects' },
    { title: 'Users', icon: <FiUsers />, link: '/users' },
  ];

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogoutClick = () => setShowLogoutPopup(true);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl shadow-2xl text-blue-400 hover:text-blue-300 transition-colors"
      >
        {isSidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed w-64 h-full bg-gradient-to-b from-[#1E2939] to-[#0F172A] transform transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 z-40 flex flex-col border-r border-slate-800`}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            E-TRACKER
          </h1>
          <div className="mt-2 h-px bg-gradient-to-r from-blue-500/20 to-transparent" />
        </div>
        
        {/* Main Menu */}
        <div className="flex-grow p-4">
          <div className="mb-6 pl-2">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider border-l-4 border-blue-500 pl-3">
              Menu
            </h2>
          </div>
          
          <nav>
            <ul className="space-y-2">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <Link
                    to={item.link}
                    className="flex items-center p-3 rounded-lg group transition-all hover:bg-blue-600/10 hover:border-blue-500/20 border border-transparent"
                  >
                    <span className="text-xl mr-3 text-slate-400 group-hover:text-blue-300 transition-colors">
                      {item.icon}
                    </span>
                    <span className="text-slate-300 group-hover:text-blue-100 font-medium transition-colors">
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Logout Section */}
        <div className="p-4 mt-auto border-t border-slate-800">
          <button
            onClick={handleLogoutClick}
            className="flex items-center w-full p-3 rounded-lg group transition-all hover:bg-rose-600/10 hover:border-rose-500/20 border border-transparent"
          >
            <span className="text-xl mr-3 text-slate-400 group-hover:text-rose-300 transition-colors">
              <FiLogOut />
            </span>
            <span className="text-slate-300 group-hover:text-rose-100 font-medium transition-colors">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm md:hidden z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Logout Popup - Keep your existing conditional rendering */}
      {showLogoutPopup && (
        <LogoutPopup onClose={() => setShowLogoutPopup(false)} />
      )}
    </>
  );
}