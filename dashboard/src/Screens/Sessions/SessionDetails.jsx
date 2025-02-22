// SessionDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { getRequest } from '../../Actions/request';

Chart.register(...registerables);

export default function SessionDetails() {
  const { sessionId } = useParams();
  const [apps, setApps] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appsRes, screensRes] = await Promise.all([
          getRequest(`/sessionForegroundApp/session/${sessionId}`),
          getRequest(`/screenshots/${sessionId}`)
        ]);
        
        setApps(appsRes);
        setScreenshots(screensRes);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  // Process data for chart
  const chartData = {
    labels: apps.map(app => app.appName),
    datasets: [{
      label: 'Usage Time (minutes)',
      data: apps.map(app => {
        const [hours, mins] = app.totalUsageTime.split(':').slice(0, 2);
        return parseInt(hours) * 60 + parseInt(mins);
      }),
      backgroundColor: apps.map(app => 
        app.appName.toLowerCase() === 'idle' ? '#ffa500' : '#3b82f6'
      ),
    }]
  };

  if (loading) return <div className="text-white text-center p-8">Loading...</div>;

  return (
    <div className="bg-slate-900 min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Session Details</h1>
        
        {/* Chart Section */}
        <div className="bg-[#1E2939] p-6 rounded-lg mb-8">
          <h2 className="text-xl text-white mb-4">Application Usage Breakdown</h2>
          <div className="h-96">
            <Bar 
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} mins`
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-[#1E2939] rounded-lg p-6 mb-8">
          <h2 className="text-xl text-white mb-4">Application Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-slate-700">
                  <th className="pb-3 text-left">Application</th>
                  <th className="pb-3 text-left">Status</th>
                  <th className="pb-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app, index) => {
                  const [hours, mins, secs] = app.totalUsageTime.split(':').map(Number);
                  return (
                    <tr 
                      key={app.id}
                      className={`${index !== apps.length - 1 ? 'border-b border-slate-700' : ''}`}
                    >
                      <td className="py-4">
                        <span className={`text-white ${
                          app.appName.toLowerCase() === 'idle' ? 'text-orange-400' : ''
                        }`}>
                          {app.appName}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          app.status === 'Active' 
                            ? 'bg-green-800/30 text-green-400' 
                            : 'bg-gray-700/30 text-gray-400'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-4 text-white">
                        {hours > 0 && `${hours}h `}
                        {mins > 0 && `${mins}m `}
                        {secs}s
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Screenshots Grid */}
        <div className="bg-[#1E2939] rounded-lg p-6">
          <h2 className="text-xl text-white mb-4">Session Screenshots</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {screenshots.map((screenshot, index) => (
              <div 
                key={index}
                className="relative group overflow-hidden rounded-lg hover:transform hover:scale-105 transition-all"
              >
                <img 
                  src={screenshot.url} 
                  alt={`Screenshot ${index + 1}`}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm">
                    {new Date(screenshot.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}