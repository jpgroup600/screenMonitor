import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { FaImage, FaTable, FaExclamationTriangle, FaClock, FaTimes, FaChevronLeft, FaChevronRight, FaSpinner } from 'react-icons/fa';
import request from '../../Actions/request';

Chart.register(...registerables);

export default function SessionDetails() {
  const { sessionId } = useParams();
  const [apps, setApps] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingScreenshots, setLoadingScreenshots] = useState(true);
  const [errorApps, setErrorApps] = useState(null);
  const [errorScreenshots, setErrorScreenshots] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await request.get(`/sessionForegroundApp/session/${sessionId}`);
        setApps(response);
      } catch (err) {
        setErrorApps('Failed to load application data');
      } finally {
        setLoadingApps(false);
      }
    };

    const fetchScreenshots = async () => {
      try {
        const response = await request.get(`/screenshots/${sessionId}`);
        const formatted = response.map(screenshot => ({
          ...screenshot,
          url: `${import.meta.env.VITE_IMAGE_URL}/${screenshot.fileName}`
        }));
        setScreenshots(formatted);
      } catch (err) {
        setErrorScreenshots('Failed to load screenshots');
      } finally {
        setLoadingScreenshots(false);
      }
    };

    fetchApps();
    fetchScreenshots();
  }, [sessionId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') navigateImage('prev');
        if (e.key === 'ArrowRight') navigateImage('next');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedImage]);

  const handleImageClick = (index) => {
    setSelectedImage(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  const navigateImage = (direction) => {
    setSelectedImage(prev => {
      if (direction === 'prev') return prev > 0 ? prev - 1 : screenshots.length - 1;
      return prev < screenshots.length - 1 ? prev + 1 : 0;
    });
  };

  const processAppData = () => {
    const appMap = apps.reduce((acc, app) => {
      const [h, m] = app.totalUsageTime.split(':');
      const totalMinutes = parseInt(h) * 60 + parseInt(m);
      
      if (acc[app.appName]) {
        acc[app.appName].totalUsage += totalMinutes;
      } else {
        acc[app.appName] = {
          ...app,
          totalUsage: totalMinutes
        };
      }
      return acc;
    }, {});

    return Object.values(appMap);
  };

  const processedApps = processAppData();

  const renderDataSection = (title, icon, content) => (
    <div className="group relative bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 border border-slate-700 shadow-xl hover:border-blue-500/30 transition-all duration-300 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
          {React.cloneElement(icon, { className: 'text-blue-400' })}
        </div>
        <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      {content}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
    </div>
  );

  const renderLoading = () => (
    <div className="flex justify-center items-center h-64">
      <FaSpinner className="animate-spin text-4xl text-blue-400" />
    </div>
  );

  const renderError = (message) => (
    <div className="text-center py-8 text-slate-400">
      <FaExclamationTriangle className="text-4xl mx-auto mb-4 text-rose-400" />
      <p className="text-base font-medium">{message}</p>
    </div>
  );

  const chartData = {
    labels: processedApps.map(app => app.appName),
    datasets: [{
      label: 'Usage Time (minutes)',
      data: processedApps.map(app => app.totalUsage),
      backgroundColor: processedApps.map(app => 
        app.appName.toLowerCase() === 'idle' ? 'rgb(251 191 36)' : 'rgb(59 130 246)'
      ),
      borderRadius: 8,
      barThickness: 32,
    }]
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#1E2939] to-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-4 border-b border-slate-700/50 pb-6">
          <FaClock className="text-4xl text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Session Analytics
            </h1>
            <span className="text-sm text-slate-400 font-mono">#{sessionId.slice(0, 8)}</span>
          </div>
        </header>

        {/* Application Insights Section */}
        {loadingApps ? renderLoading() : errorApps ? renderError(errorApps) : 
          renderDataSection(
            'Application Usage',
            <FaTable />,
            <>
              <div className="h-96 mb-6">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#CBD5E1',
                        bodyColor: '#E2E8F0',
                        borderColor: '#1E293B',
                        borderWidth: 1,
                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} mins` }
                      }
                    },
                    scales: {
                      y: {
                        grid: { color: '#1E293B' },
                        ticks: { color: '#94A3B8' },
                      },
                      x: {
                        grid: { color: '#1E293B' },
                        ticks: { color: '#94A3B8' }
                      }
                    }
                  }}
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-slate-300 font-medium">Application</th>
                      <th className="px-6 py-4 text-left text-slate-300 font-medium">Status</th>
                      <th className="px-6 py-4 text-left text-slate-300 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {apps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`font-medium ${app.appName.toLowerCase() === 'idle' ? 'text-amber-400' : 'text-slate-200'}`}>
                            {app.appName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                            app.status === 'Active' 
                              ? 'bg-emerald-900/30 text-emerald-400' 
                              : 'bg-slate-700/30 text-slate-400'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-200">
                          {app.totalUsageTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }

        {/* Screenshots Gallery Section */}
        {loadingScreenshots ? renderLoading() : errorScreenshots ? renderError(errorScreenshots) : 
          renderDataSection(
            'Session Screenshots',
            <FaImage />,
            screenshots.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {screenshots.map((screenshot, index) => (
                  <div 
                    key={index}
                    className="relative group overflow-hidden rounded-lg aspect-video bg-slate-800 border border-slate-700 transition-all hover:border-blue-500/30 cursor-zoom-in"
                    onClick={() => handleImageClick(index)}
                  >
                    <img
                      src={screenshot.url}
                      alt={`Session capture ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent p-3 flex items-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-sm text-slate-300">
                        {new Date(screenshot.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <FaImage className="text-4xl mx-auto mb-4 text-slate-600" />
                <p className="text-base font-medium">No screenshots available</p>
              </div>
            )
          )
        }

        {/* Lightbox Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl h-full max-h-[90vh]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:text-blue-400 transition-colors z-10"
              >
                <FaChevronLeft className="text-3xl" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:text-blue-400 transition-colors z-10"
              >
                <FaChevronRight className="text-3xl" />
              </button>

              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-2 text-white hover:text-rose-400 transition-colors z-10"
              >
                <FaTimes className="text-2xl" />
              </button>

              <div className="relative h-full flex items-center justify-center" onClick={closeModal}>
                <img
                  src={screenshots[selectedImage]?.url}
                  alt={`Fullscreen view ${selectedImage + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl border border-slate-700"
                />
                
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <span className="inline-block bg-slate-800/80 text-slate-200 px-4 py-2 rounded-lg text-sm">
                    {new Date(screenshots[selectedImage]?.createdAt).toLocaleString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}