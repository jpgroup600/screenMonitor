// src/Components/Project/ProjectForm.jsx
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import request from '../../Actions/request'; // Adjust the path as needed

export default function ProjectForm({ setIsModalOpen, handleCreateProject }) {
  // Initialize form state with default values
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    endDate: new Date(),
    status: 'Active'
  });

  // State for loading spinner and error messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    // Basic validation: ensure name and description are provided.
    if (!newProject.name || !newProject.description) return;

    setLoading(true);
    setError(null);

    try {
      // Send a POST request using the post method from request.js.
      // This will call: POST `${process.env.BACKEND_URL}/project`
      const response = await request.post('/project', newProject);

      // Optionally update parent state with the new project.
      handleCreateProject(newProject);

      // Reset the form fields.
      setNewProject({
        name: '',
        description: '',
        endDate: new Date(),
        status: 'Active'
      });

      // Close the modal.
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
      <div className="relative bg-[#121222] rounded-xl p-8 w-full max-w-md">
        <h2 className="text-white text-2xl mb-6">New Project</h2>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {/* Loading Spinner Overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="border-4 border-t-4 border-gray-200 rounded-full w-12 h-12 animate-spin"></div>
            <p className="text-white mt-4">Creating Project...</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-[#5D7274] mb-2">Project Name</label>
            <input
              type="text"
              className="w-full bg-[#020617] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={newProject.name}
              onChange={(e) =>
                setNewProject({ ...newProject, name: e.target.value })
              }
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#5D7274] mb-2">Description</label>
            <textarea
              className="w-full bg-[#020617] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows="3"
              value={newProject.description}
              onChange={(e) =>
                setNewProject({ ...newProject, description: e.target.value })
              }
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-[#5D7274] mb-2">Due Date</label>
            <DatePicker
              selected={newProject.endDate}
              onChange={(date) =>
                setNewProject({ ...newProject, endDate: date })
              }
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full bg-[#020617] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              wrapperClassName="w-full"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[#5D7274] mb-2">Status</label>
            <select
              className="w-full bg-[#020617] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={newProject.status}
              onChange={(e) =>
                setNewProject({ ...newProject, status: e.target.value })
              }
            >
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="OnHold">OnHold</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 text-[#5D7274] hover:text-white transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#0068f7] hover:bg-[#0067f7a1] text-white px-6 py-2 rounded-lg transition-all duration-150"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
