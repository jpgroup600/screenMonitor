// src/pages/Projects.jsx
import { useState, useEffect } from 'react';
import { FaSpinner, FaPlus } from 'react-icons/fa';
import ProjectForm from '../Components/Project/ProjectForm';
import ProjectItem from '../Components/Project/ProjectItem';
import request from '../Actions/request';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      setLoadingProjects(true);
      try {
        const fetchedProjects = await request.get('/project/all');
        setProjects(fetchedProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, []);

  const handleCreateProject = async (newProject) => {
    if (!newProject.name || !newProject.description) return;
    try {
      await request.post('/project', newProject);
      const updatedProjects = await request.get('/project/all');
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Error creating project:', error);
    }
    setIsModalOpen(false);
  };

  const deleteProject = async (projectId) => {
    try {
      await request.delete(`/project/${projectId}`);
      const updatedProjects = await request.get('/project/all');
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Project Management
          </h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all"
          >
            <FaPlus className="text-lg" />
            <span>New Project</span>
          </button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loadingProjects ? (
            <div className="col-span-full flex items-center justify-center py-16">
              <FaSpinner className="animate-spin text-blue-400" size={40} />
            </div>
          ) : projects.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-slate-400">No projects found. Create your first project!</p>
            </div>
          ) : (
            projects.map((project, index) => (
              <ProjectItem
                key={project.id || index}
                project={project}
                deleteProject={() => deleteProject(project.id)}
              />
            ))
          )}
        </div>

        {/* Create Project Modal */}
        {isModalOpen && (
          <ProjectForm
            setIsModalOpen={setIsModalOpen}
            handleCreateProject={handleCreateProject}
          />
        )}
      </div>
    </div>
  );
}