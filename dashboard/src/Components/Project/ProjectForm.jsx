import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import request from '../../Actions/request';
import { FaSpinner } from 'react-icons/fa';

export default function ProjectForm({ setIsModalOpen, handleCreateProject }) {
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    endDate: new Date(),
    status: 'Active'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!newProject.name || !newProject.description) return;
  
    setLoading(true);
    setError(null);
  
    try {
      const formattedProject = {
        ...newProject,
        endDate: newProject.endDate ? newProject.endDate.toISOString() : null,
      };
  
      const response = await request.post("/project", formattedProject);
      handleCreateProject(formattedProject);
      setNewProject({ name: "", description: "", endDate: new Date(), status: "Active" });
      setIsModalOpen(false);
    } catch (err) {
      setError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            New Project
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-900/30 text-rose-400 rounded-lg border border-rose-800/50">
            {error}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center rounded-xl">
            <FaSpinner className="animate-spin text-blue-400 text-3xl" />
            <p className="text-slate-300 mt-3">Creating Project...</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-slate-400 text-sm font-medium">Project Name</label>
            <input
              type="text"
              className="w-full bg-slate-900/50 text-slate-300 rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-slate-400 text-sm font-medium">Description</label>
            <textarea
              className="w-full bg-slate-900/50 text-slate-300 rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all h-32"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-slate-400 text-sm font-medium">Due Date</label>
            <DatePicker
              selected={newProject.endDate}
              onChange={(date) => setNewProject({ ...newProject, endDate: date })}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full bg-slate-900/50 text-slate-300 rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
              wrapperClassName="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-slate-400 text-sm font-medium">Status</label>
            <select
              className="w-full bg-slate-900/50 text-slate-300 rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
              value={newProject.status}
              onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
            >
              <option value="Active" className="bg-slate-800">Active</option>
              <option value="Completed" className="bg-slate-800">Completed</option>
              <option value="OnHold" className="bg-slate-800">On Hold</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 border-t border-slate-700 pt-6">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-5 py-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)] transition-all"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}