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
  }, [isModalOpen]);

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
    <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 bg-slate-800 rounded-lg">{icon}</div>
        <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
      </div>
      {content}
    </div>
  );

  const renderLoading = () => (
    <div className="flex justify-center items-center h-64">
      <FaSpinner className="animate-spin text-4xl text-blue-400" />
    </div>
  );

  const renderError = (message) => (
    <div className="text-center py-8 sm:py-12 text-slate-400">
      <FaExclamationTriangle className="text-3xl sm:text-4xl mx-auto mb-3 sm:mb-4 text-rose-400" />
      <p className="text-sm sm:text-base font-medium">{message}</p>
    </div>
  );

  const chartData = {
    labels: processedApps.map(app => app.appName),
    datasets: [{
      label: 'Usage Time (minutes)',
      data: processedApps.map(app => app.totalUsage),
      backgroundColor: processedApps.map(app => 
        app.appName.toLowerCase() === 'idle' ? '#f59e0b' : '#3b82f6'
      ),
      borderRadius: 8,
      barThickness: 32,
    }]
  };

  return (
    <div className="bg-slate-900 min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <header className="flex items-center gap-3 sm:gap-4">
          <FaClock className="text-3xl sm:text-4xl text-blue-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Session Analytics</h1>
          <span className="text-sm sm:text-base text-slate-400 font-mono">#{sessionId.slice(0, 8)}</span>
        </header>

        {/* Application Insights Section */}
        {loadingApps ? renderLoading() : errorApps ? renderError(errorApps) : 
          renderDataSection(
            'Application Usage',
            <FaTable className="text-xl sm:text-2xl text-blue-400" />,
            <>
              <div className="h-80 sm:h-96 overflow-auto mb-4">
                <div className="h-full min-w-[400px] sm:min-w-0">
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
                          callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} mins`
                          }
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
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-700 max-h-[500px]">
                <table className="w-full">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-slate-300 font-medium text-sm sm:text-base">Application</th>
                      <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-slate-300 font-medium text-sm sm:text-base">Status</th>
                      <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-slate-300 font-medium text-sm sm:text-base">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {apps.map((app, index) => {
                      const [h, m, s] = app.totalUsageTime.split(':').map(Number);
                      return (
                        <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 sm:px-6 sm:py-4">
                            <span className={`font-medium text-sm sm:text-base ${
                              app.appName.toLowerCase() === 'idle' ? 'text-amber-400' : 'text-white'
                            }`}>
                              {app.appName}
                            </span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4">
                            <span className={`inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm ${
                              app.status === 'Active' 
                                ? 'bg-emerald-900/30 text-emerald-400' 
                                : 'bg-slate-700/30 text-slate-400'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 text-slate-200 text-sm sm:text-base">
                            {h > 0 && `${h}h `}
                            {m > 0 && `${m}m `}
                            {s}s
                          </td>
                        </tr>
                      )
                    })}
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
            <FaImage className="text-xl sm:text-2xl text-purple-400" />,
            screenshots.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 overflow-y-auto max-h-[800px]">
                {screenshots.map((screenshot, index) => (
                  <div 
                    key={index}
                    className="relative group overflow-hidden rounded-lg aspect-video bg-slate-800 transition-transform hover:scale-[1.02] cursor-zoom-in"
                    onClick={() => handleImageClick(index)}
                  >
                    <img
                      src={screenshot.url}
                      alt={`Session capture ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent p-2 sm:p-3 flex items-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs sm:text-sm text-slate-300">
                        {new Date(screenshot.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-slate-400">
                <FaImage className="text-3xl sm:text-4xl mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base font-medium">No screenshots available</p>
              </div>
            )
          )
        }

        {/* Lightbox Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div 
              className="relative w-full max-w-6xl h-full max-h-[90vh]"
              onClick={closeModal}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white hover:text-blue-400 transition-colors z-10"
              >
                <FaChevronLeft className="text-2xl sm:text-3xl" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white hover:text-blue-400 transition-colors z-10"
              >
                <FaChevronRight className="text-2xl sm:text-3xl" />
              </button>

              <button
                onClick={closeModal}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 p-1 sm:p-2 text-white hover:text-rose-400 transition-colors z-10"
              >
                <FaTimes className="text-xl sm:text-2xl" />
              </button>

              <div className="relative h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img
                  src={screenshots[selectedImage]?.url}
                  alt={`Fullscreen view ${selectedImage + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                />
                
                <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 text-center">
                  <span className="inline-block bg-slate-800/80 text-slate-200 px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm">
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