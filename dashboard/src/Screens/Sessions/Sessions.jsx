import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SessionCard from "../../Components/Session/SessionCard";
import { FaClock } from "react-icons/fa";
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
      <div className="w-full min-h-screen p-8 lg:p-0">
        <div className="max-w-4xl mx-auto text-white text-center">
          Loading sessions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen p-8 lg:p-0">
        <div className="max-w-4xl mx-auto text-red-400 text-center">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-8 lg:p-0">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
          <FaClock className="text-blue-400" />
          Work Sessions
        </h1>
        
        <div className="space-y-4">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <SessionCard key={session.sessionId} session={session} />
            ))
          ) : (
            <div className="text-gray-400 text-center">
              No sessions found for this employee/project
            </div>
          )}
        </div>
      </div>
    </div>
  );
}