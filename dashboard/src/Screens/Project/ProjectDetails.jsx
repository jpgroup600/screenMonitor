// src/Screens/Project/ProjectDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../Actions/request';
import EmployeeCard from '../../Components/Project/EmployeeCard';
import TeamModal from '../../Components/Project/TeamModal';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [error, setError] = useState(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Fetch project details from backend
  useEffect(() => {
    async function fetchProjectDetails() {
      setLoadingProject(true);
      try {
        const proj = await request.get(`/project/${projectId}`);
        setProject(proj);
      } catch (err) {
        console.error('Error fetching project details:', err);
        setError('Error fetching project details.');
      } finally {
        setLoadingProject(false);
      }
    }
    fetchProjectDetails();
  }, [projectId]);

  // Refresh project details after team changes
  const refreshProjectDetails = async () => {
    try {
      const proj = await request.get(`/project/${projectId}`);
      setProject(proj);
    } catch (err) {
      console.error('Error refreshing project details:', err);
    }
  };

  if (loadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="animate-spin">
          <svg className="h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-white">
        <p>{error || 'Project data not available.'}</p>
        <button onClick={() => navigate('/projects')} className="text-teal-500 hover:underline">
          Back to Projects
        </button>
      </div>
    );
  }

  // Assume the project object contains: id, name, description, endDate, status, and (optionally) team members in a field (e.g., project.team)
  const teamMembers = project.team || []; // Adjust if your API returns a different field

  return (
    <div className="min-h-screen p-8 bg-[#020617] text-white">
      <button onClick={() => navigate(-1)} className="mb-4 text-teal-500 hover:underline">
        &larr; Back
      </button>

      {/* Project Info */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 transition-transform duration-300 hover:scale-105">
        <h1 className="text-3xl font-bold mb-4">{project.name}</h1>
        <p className="mb-4">{project.description}</p>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <p>
            Due Date:{' '}
            <span className="font-medium">{new Date(project.endDate).toLocaleDateString()}</span>
          </p>
          <p>
            Status: <span className="font-medium">{project.status}</span>
          </p>
        </div>
      </div>

      {/* Team Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Project Team</h2>
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="bg-[#0068f7] hover:bg-[#0067f7bb] text-white px-4 py-2 rounded-lg transition-all duration-300"
          >
            Build a Team
          </button>
        </div>
        {teamMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member) => (
              <EmployeeCard key={member.id} employee={member} isSelected={false} onSelect={() => {}} />
            ))}
          </div>
        ) : (
          <p>No team members assigned yet.</p>
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
