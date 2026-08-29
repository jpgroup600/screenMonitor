import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SessionCard from "../../Components/Session/SessionCard";
import { FaClock, FaSpinner, FaAngleLeft, FaAngleRight, FaCalendarAlt, FaTrash } from "react-icons/fa";
import request from "../../Actions/request";

export default function Sessions() {
  const { employeeId, projectId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const sessionsPerPage = 12;

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await request.get(
          `/session/get?employeeId=${employeeId}&projectId=${projectId}`
        );
        setSessions(data);
      } catch (err) {
        setError(err.message || "Failed to fetch sessions");
      } finally {
        setLoading(false);
      }
    };

    employeeId && projectId && fetchSessions();
  }, [employeeId, projectId]);

  useEffect(() => setCurrentPage(1), [selectedDate]);

  // Get unique dates for filter
  const uniqueDates = [...new Set(sessions.map(session => 
    new Date(session.startTime).toLocaleDateString('en-CA')
  ))].sort((a, b) => new Date(b) - new Date(a));

  // Filter and paginate sessions
  const filteredSessions = selectedDate === "all" 
    ? sessions 
    : sessions.filter(session => 
        new Date(session.startTime).toLocaleDateString('en-CA') === selectedDate
      );

  const indexOfLastSession = currentPage * sessionsPerPage;
  const indexOfFirstSession = indexOfLastSession - sessionsPerPage;
  const currentSessions = filteredSessions.slice(indexOfFirstSession, indexOfLastSession);
  const totalPages = Math.ceil(filteredSessions.length / sessionsPerPage);

  // Group sessions by date
  const groupedSessions = currentSessions.reduce((acc, session) => {
    const dateStr = new Date(session.startTime).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    acc[dateStr] = [...(acc[dateStr] || []), session];
    return acc;
  }, {});

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  const handleDeleteAllSessions = async () => {
    if (!window.confirm('Are you sure you want to delete ALL sessions? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await request.delete(`/session/delete?employeeId=${employeeId}&projectId=${projectId}`);
      // Refresh the sessions list after deletion
      const data = await request.get(`/session/get?employeeId=${employeeId}&projectId=${projectId}`);
      setSessions(data);
      alert('All sessions deleted successfully');
    } catch (err) {
      setError(err.message || "Failed to delete sessions");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="flex items-center gap-3 text-blue-400">
        <FaSpinner className="animate-spin" size={24} />
        <span>Loading sessions...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="text-rose-400 text-center p-8 max-w-2xl">
        Error: {error}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FaClock className="text-blue-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Work Sessions
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <FaCalendarAlt className="text-blue-400" />
              <select 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#1E2939] text-white px-4 py-2 rounded-md border border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Dates</option>
                {uniqueDates.map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleDeleteAllSessions}
              disabled={sessions.length === 0 || isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaTrash />
              )}
              <span>Delete All</span>
            </button>
          </div>
        </div>

        {Object.entries(groupedSessions).map(([date, dateSessions]) => (
          <div key={date} className="mb-8">
            <div className="flex items-center gap-3 mb-4 border-b border-blue-800/50 pb-2">
              <h2 className="text-xl font-semibold text-blue-400">{date}</h2>
              <span className="text-sm text-slate-400">
                {dateSessions.length} session{dateSessions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
              {dateSessions.map((session) => (
                <SessionCard 
                  key={session.sessionId} 
                  session={session}
                  employeeId={employeeId}
                  projectId={projectId}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-8">
            No sessions found for selected date
          </div>
        )}

        {filteredSessions.length > sessionsPerPage && (
          <div className="flex justify-center items-center mt-8 gap-2">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className={`p-2 rounded-md ${currentPage === 1 ? 'text-gray-500 cursor-not-allowed' : 'text-blue-400 hover:bg-blue-900/30'}`}
            >
              <FaAngleLeft size={20} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i+1}
                onClick={() => paginate(i+1)}
                className={`w-10 h-10 rounded-md ${currentPage === i+1 ? 'bg-blue-600 text-white' : 'text-blue-400 hover:bg-blue-900/30'}`}
              >
                {i+1}
              </button>
            ))}

            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-md ${currentPage === totalPages ? 'text-gray-500 cursor-not-allowed' : 'text-blue-400 hover:bg-blue-900/30'}`}
            >
              <FaAngleRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}