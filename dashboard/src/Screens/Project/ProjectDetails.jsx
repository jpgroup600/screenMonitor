import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../Actions/request';
import TeamModal from '../../Components/Project/TeamModal';
import { OnlineUsersContext } from '../../Contexts/OnlineUsersContext';
import EmployeeCardSession from '../../Components/Session/EmployeeCardSession';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const { onlineUserIds } = useContext(OnlineUsersContext);

  const statusColors = {
    Completed: 'from-green-600 to-emerald-700',
    OnHold: 'from-amber-600 to-yellow-700',
    Active: 'from-blue-600 to-indigo-700',
    Default: 'from-slate-600 to-slate-700'
  };

  useEffect(() => {
    async function fetchProjectDetails() {
      try {
        const proj = await request.get(`/project/${projectId}`);
        setProject(proj);
      } catch (err) {
        console.error('Error fetching project details:', err);
        setError('Error fetching project details.');
      }
    }

    async function fetchProjectEmployees() {
      try {
        const employees = await request.get(`/project/employees/${projectId}`);
        setTeamMembers(employees);
      } catch (err) {
        console.error('Error fetching project employees:', err);
      }
    }

    fetchProjectDetails();
    fetchProjectEmployees();
    setLoading(false);
  }, [projectId]);

  const refreshProjectDetails = async () => {
    try {
      const employees = await request.get(`/project/employees/${projectId}`);
      setTeamMembers(employees);
    } catch (err) {
      console.error('Error refreshing project employees:', err);
    }
  };

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

  if (!project) {
    return (
      <div className="p-8 text-slate-300 bg-gradient-to-br from-[#1E2939] to-[#0F172A] min-h-screen">
        <p className="mb-4">{error || 'Project data not available.'}</p>
        <button 
          onClick={() => navigate('/projects')} 
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          &larr; Back to Projects
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

      {/* Project Info Card */}
      <div className="group relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 shadow-xl hover:border-blue-500/30 transition-all duration-300 mb-8">
        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          {project.name}
        </h1>
        <p className="text-slate-400 mb-6">{project.description}</p>
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center border-t border-slate-700/50 pt-4">
          <div className="mb-4 md:mb-0">
            <p className="text-slate-400">
              Due: <span className="text-slate-200">{new Date(project.endDate).toLocaleDateString()}</span>
            </p>
          </div>
          <span className={`bg-gradient-to-r ${
            statusColors[project.status] || statusColors.Default
          } px-3 py-1 rounded-full text-slate-100 text-sm font-medium border border-slate-600`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* Team Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Project Team
          </h2>
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all"
          >
            Build Team
          </button>
        </div>
        
        {teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {teamMembers.map((member) => (
              <EmployeeCardSession 
                key={member.id} 
                employee={member} 
                isOnline={onlineUserIds.includes(member.id)}
                projectId={projectId}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-400 py-8">No team members assigned yet.</p>
        )}
      </div>

      {/* Team Building Modal */}
      {isTeamModalOpen && (
        <TeamModal
          projectId={projectId}
          onClose={() => setIsTeamModalOpen(false)}
          refreshProjectDetails={refreshProjectDetails}
        />
      )}
    </div>
  );
}