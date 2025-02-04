// App.js
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Components/Sidebar";
import Dashboard from "./Screens/Dashboard";
import Projects from "./Screens/Projects";
import ProjectDetails from "./Screens/Project/ProjectDetails";
import Login from "./Screens/Auth/Login";
import Users from "./Screens/Users";

function App() {
  const token = localStorage.getItem("token");

  // If not logged in, only show the Login page.
  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Redirect any route to /login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // When logged in, render the sidebar and the main routes.
  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/users" element={<Users/>}/>
          {/* Optionally, redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
