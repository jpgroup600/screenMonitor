import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import request from "../../../Actions/request";

export default function ScreenshotIntervalModal({ userId, projects, onClose }) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Convert HH:MM:SS to total seconds
  const timeStringToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
  };

  useEffect(() => {
    const fetchInterval = async () => {
      if (selectedProjectId) {
        try {
          const res = await request.get(
            `/project/${selectedProjectId}/employee/${userId}/screenshot-interval`
          );
          // Convert HH:MM:SS to minutes for display
          const totalSeconds = timeStringToSeconds(res.screenshotInterval);
          setMinutes(Math.floor(totalSeconds / 60));
        } catch (err) {
          console.error('Error fetching interval:', err);
          setMinutes('');
        }
      }
    };
    fetchInterval();
  }, [selectedProjectId, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!selectedProjectId) {
        throw new Error('Please select a project');
      }
      if (!minutes || isNaN(minutes)) {
        throw new Error('Please enter a valid number of minutes');
      }
      
      // Convert minutes to seconds
      const seconds = Math.floor(minutes * 60);
      
      await request.post(
        `/project/${selectedProjectId}/employee/${userId}/screenshot-interval`,
        { seconds } // Send as seconds in the required format
      );
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update interval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold text-emerald-400 mb-4">Screenshot Interval</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <p className="text-slate-300 text-sm">Select Project:</p>
            {projects?.map(project => (
              <label 
                key={project.id}
                className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-700/50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="project"
                  value={project.id}
                  checked={selectedProjectId === project.id}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="form-radio text-emerald-400 border-slate-600"
                />
                <span className="text-slate-300">{project.name}</span>
              </label>
            ))}
          </div>

          {selectedProjectId && (
            <div>
              <label className="text-slate-300 block mb-1">Interval (minutes)</label>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
                min="1"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-blue-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedProjectId || submitting || !minutes}
              className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </form>
      </div>
    </div>
  );
}