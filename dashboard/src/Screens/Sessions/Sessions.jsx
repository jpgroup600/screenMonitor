import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SessionCard from "../../Components/Session/SessionCard";
import { FaClock, FaSpinner } from "react-icons/fa";
import request from "../../Actions/request";

export default function Sessions() {
  const { employeeId, projectId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

    if (employeeId && projectId) {
      fetchSessions();
    }
  }, [employeeId, projectId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
        <div className="flex items-center gap-3 text-blue-400">
          <FaSpinner className="animate-spin" size={24} />
          <span>Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
        <div className="text-rose-400 text-center p-8 max-w-2xl">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          <FaClock className="text-blue-400" />
          Work Sessions
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <SessionCard key={session.sessionId} session={session} />
            ))
          ) : (
            <div className="col-span-full text-center text-slate-400 py-8">
              No sessions found for this employee/project
            </div>
          )}
        </div>
      </div>
    </div>
  );
}