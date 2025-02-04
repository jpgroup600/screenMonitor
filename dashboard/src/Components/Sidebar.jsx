// src/Components/Sidebar.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiGrid, 
  FiFolder, 
  FiUsers, 
  FiSettings, 
  FiLogOut 
} from 'react-icons/fi';
import LogoutPopup from './LogoutPopup';

export default function Sidebar() {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const menuItems = [
    { title: 'Dashboard', icon: <FiGrid />, link: '/' },
    { title: 'Projects', icon: <FiFolder />, link: '/projects' },
    { title: 'Users', icon: <FiUsers />, link: '/users' },
    { title: 'Settings', icon: <FiSettings />, link: '/settings' },
    // Logout will be handled separately
    { title: 'Logout', icon: <FiLogOut />, link: '/logout' },
  ];

  const handleLogoutClick = () => {
    setShowLogoutPopup(true);
  };

  return (
    <>
      <aside className="fixed w-64 h-full p-2 bg-[#121222]">
        <div className="flex items-center gap-3 m-10">
          <h1 className="text-white font-semibold text-3xl">E-TRACKER</h1>
        </div>
        
        <div className="mt-12">
          <div className="flex items-center m-4">
            <h2 className="text-gray-500">MENU</h2>
          </div>
          
          <nav>
            <ul className="space-y-4">
              {menuItems.map((item, index) => (
                <li key={index}>
                  {item.title === 'Logout' ? (
                    <button
                      onClick={handleLogoutClick}
                      className="flex items-center w-full p-4 rounded-xl transition-all hover:bg-red-600 group focus:outline-none focus:ring-2 focus:ring-red-500 border border-transparent hover:border-red-500"
                    >
                      <span className="text-2xl mr-4 transition-all text-[#959697] group-hover:text-white group-hover:drop-shadow-[0_0_12px_rgba(255,0,0,0.7)] group-hover:scale-105">
                        {item.icon}
                      </span>
                      <span className="text-[#959697] group-hover:text-white font-semibold text-lg transition-colors">
                        {item.title}
                      </span>
                    </button>
                  ) : (
                    <Link
                      to={item.link}
                      className="flex items-center p-4 rounded-xl transition-all hover:bg-[#0068f7] group hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0068f7] border border-transparent hover:border-[#005ac7]"
                    >
                      <span className="text-2xl mr-4 transition-all text-[#959697] group-hover:text-white group-hover:drop-shadow-[0_0_12px_rgba(0,104,247,0.7)] group-hover:scale-105">
                        {item.icon}
                      </span>
                      <span className="text-[#959697] group-hover:text-white font-semibold text-lg transition-colors">
                        {item.title}
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      {showLogoutPopup && (
        <LogoutPopup onClose={() => setShowLogoutPopup(false)} />
      )}
    </>
  );
}
