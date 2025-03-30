// App.js
import { useState } from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Components/Sidebar";
import Dashboard from "./Screens/Dashboard";
import Projects from "./Screens/Projects";
import ProjectDetails from "./Screens/Project/ProjectDetails";
import Login from "./Screens/Auth/Login";
import Users from "./Screens/Users";
import { OnlineUsersProvider } from "./Contexts/OnlineUsersContext";
import Sessions from "./Screens/Sessions/Sessions";
import SessionDetails from './Screens/Sessions/SessionDetails';
import EmployeeProfile from './Screens/User/EmployeeProfile';

function App() {
  const token = localStorage.getItem("token");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <OnlineUsersProvider>
      <div className="flex">
        <Sidebar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen} 
        />
        <div className="flex-1 mt-8 lg:mt-0 md:ml-64 transition-all duration-300">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/users" element={<Users />} />
            <Route path="/sessions/:employeeId/:projectId" element={<Sessions />} />
            <Route 
              path="/employees/:employeeId/projects/:projectId/sessions/:sessionId" 
              element={<SessionDetails />}
            />
            <Route path="/users/profile/:employeeId" element={<EmployeeProfile/>}/>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </OnlineUsersProvider>
  );
}

export default App;