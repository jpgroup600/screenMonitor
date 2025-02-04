// src/Components/Project/ProjectItem.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectItem = ({ project, index, deleteProject }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    // Pass the project's data in the navigation state.
    navigate(`/projects/${project.id}`, { state: { project } });
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-[#121222] rounded-xl p-6 shadow-xl hover:shadow-2xl transition-transform duration-300 cursor-pointer hover:scale-105"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-white text-xl font-bold">{project.name}</h3>
        <span
          className={`px-3 py-1 text-white rounded-full text-sm ${
            project.status === 'Completed'
              ? 'bg-green-600'
              : project.status === 'OnHold'
              ? 'bg-yellow-600'
              : project.status === 'Active'
              ? 'bg-[#0068f7]'
              : 'bg-gray-600'
          }`}
        >
          {project.status}
        </span>
      </div>
      <p className="text-[#5D7274] mb-4">{project.description}</p>
      <div className="flex justify-between items-center">
        <span className="text-[#5D7274] text-sm">
          Due: {new Date(project.endDate).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation(); // prevent navigation when clicking delete
            deleteProject(project.id);
          }}
          className="text-red-400 hover:text-red-300 transition-colors duration-200"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ProjectItem;
