import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../Actions/request';
import ProjectItem from '../../Components/Project/ProjectItem';
import ScreenshotIntervalModal from '../../Components/Users/Profile/ScreenshotIntervalModal';
import EditProfileModal from '../../Components/Users/Profile/EditProfileModal';
import ResetPasswordModal from '../../Components/Users/Profile/ResetPasswordModal';

export default function EmployeeProfile() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showIntervalModal, setShowIntervalModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try{
        const projectsRes = await request.get(`/project/employee/${employeeId}/project`)
        setProjects(projectsRes);
      }catch(error){
        
      }
      
      try {
        const [employeeRes] = await Promise.all([
          request.get(`/admin/user/${employeeId}`),
        ]);
        setEmployee(employeeRes);
      } catch (err) {
        setError('Failed to load employee data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
        <div className="animate-spin">
          <svg className="h-12 w-12 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A] text-slate-300">
        <p className="mb-4 text-red-400">{error}</p>
        <button 
          onClick={() => navigate(-1)} 
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          &larr; Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <button 
        onClick={() => navigate(-1)} 
        className="mb-6 text-slate-300 hover:text-blue-300 transition-colors"
      >
        &larr; Back
      </button>

      {/* Employee Profile Section */}
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 shadow-xl mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              {employee.fullName}
            </h1>
            <p className="text-slate-400 mt-2">{employee.designation}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all"
            >
              Edit Profile
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(245,158,11,0.4)] transition-all"
            >
              Reset Password
            </button>
            <button
              onClick={() => setShowIntervalModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] transition-all"
            >
              Screenshot Interval
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-slate-300">
              <span className="text-blue-400">Email:</span> {employee.email}
            </p>
            <p className="text-slate-300">
              <span className="text-blue-400">Role:</span> {employee.role}
            </p>
            <p className="text-slate-300">
              <span className="text-blue-400">Phone:</span> {employee.phoneNumber || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent mb-6">
          Assigned Projects
        </h2>
        
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {projects.map(project => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-400 py-8">No projects assigned</p>
        )}
      </div>

      {/* Modals */}
      {showEditModal && (
        <EditProfileModal 
          employee={employee} 
          onClose={() => setShowEditModal(false)} 
          onSuccess={() => {
            setShowEditModal(false); 
          }}
        />
      )}

      {showPasswordModal && (
        <ResetPasswordModal 
          userId={employeeId}
          onClose={() => setShowPasswordModal(false)} 
        />
      )}

      {showIntervalModal && (
        <ScreenshotIntervalModal 
          userId={employeeId}
          projects={projects}
          onClose={() => setShowIntervalModal(false)} 
        />
      )}

    </div>
  );
}