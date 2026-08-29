import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectItem = ({ project, index, deleteProject }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`, { state: { project } });
  };

  const statusColors = {
    Completed: 'from-green-600 to-emerald-700',
    OnHold: 'from-amber-600 to-yellow-700',
    Active: 'from-blue-600 to-indigo-700',
    Default: 'from-slate-600 to-slate-700'
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 hover:border-blue-500/30 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-xl hover:shadow-2xl"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-blue-300 text-lg font-semibold truncate">
          {project.name}
        </h3>
        <span className={`bg-gradient-to-r ${
          statusColors[project.status] || statusColors.Default
        } px-3 py-1 rounded-full text-slate-100 text-xs font-medium border border-slate-600`}>
          {project.status}
        </span>
      </div>
      
      <p className="text-slate-400 text-sm mb-4 line-clamp-3">
        {project.description}
      </p>
      
      <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
        <span className="text-slate-500 text-xs font-medium">
          Due: {new Date(project.endDate).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteProject(project.id);
          }}
          className="text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-900/20 transition-colors duration-200"
        >
          Delete
        </button>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
    </div>
  );
};

export default ProjectItem;