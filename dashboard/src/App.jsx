import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Components/Sidebar";
import Dashboard from "./Screens/Dashboard";
import Projects from "./Screens/Projects";
import ProjectDetails from "./Screens/Project/ProjectDetails";
import Login from "./Screens/Auth/Login";
import Users from "./Screens/Users";
import { OnlineUsersProvider } from "./Contexts/OnlineUsersContext";

function App() {
  const token = localStorage.getItem("token");

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
        <Sidebar />
        <div className="ml-64 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </OnlineUsersProvider>
  );
}

export default App;
