import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaHourglassHalf } from 'react-icons/fa';

export default function SessionCard({ session, employeeId, projectId }) {
  const navigate = useNavigate();

  const formattedTime = new Date(session.startTime).toLocaleString();
  const durationParts = session.activeDuration.split('.')[0].split(':');
  const duration = `${durationParts[0]}h ${durationParts[1]}m ${durationParts[2]}s`;

  const handleClick = () => {
    navigate(`/employees/${employeeId}/projects/${projectId}/sessions/${session.sessionId}`);
  };

  return (
    <div
      className="bg-[#1E2939] rounded-lg p-6 mb-4 shadow-lg hover:shadow-xl transition-shadow duration-200 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <FaClock className="text-blue-400 text-lg" />
          <span className="text-gray-300 text-sm">{formattedTime}</span>
        </div>
        <span
          className={`text-sm px-2 py-1 rounded-full ${
            session.status === 'Complete'
              ? 'bg-green-800/30 text-green-400'
              : 'bg-yellow-800/30 text-yellow-400'
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="flex items-center gap-4 text-gray-400">
        <div className="flex items-center gap-2">
          <FaHourglassHalf className="text-purple-400" />
          <span className="text-sm">Duration:</span>
          <span className="text-white font-medium">{duration}</span>
        </div>
      </div>
    </div>
  );
}