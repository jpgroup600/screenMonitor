// src/pages/Projects.jsx
import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import ProjectForm from '../Components/Project/ProjectForm';
import ProjectItem from '../Components/Project/ProjectItem';
import request from '../Actions/request';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch projects from the backend when the component mounts
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

  // Handle project creation: send new project to backend and refresh list
  const handleCreateProject = async (newProject) => {
    if (!newProject.name || !newProject.description) return;
    try {
      await request.post('/project', newProject);
      // Refresh the project list after successful creation
      const updatedProjects = await request.get('/project/all');
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Error creating project:', error);
    }
    setIsModalOpen(false);
  };

  // Handle deletion by sending a DELETE request using the project's id
  const deleteProject = async (projectId) => {
    try {
      await request.delete(`/project/${projectId}`);
      // Refresh the project list after deletion
      const updatedProjects = await request.get('/project/all');
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[#020617]">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-white text-3xl font-bold">Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0068f7] hover:bg-[#0067f7a8] text-white px-6 py-2 rounded-lg transition-all duration-300"
        >
          Create Project
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingProjects ? (
          <div className="col-span-full flex items-center justify-center">
            <FaSpinner className="animate-spin text-white" size={50} />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-white text-center col-span-full">
            No projects found.
          </p>
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
  );
}
