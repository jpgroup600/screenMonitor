import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import Login from './Screens/Login';
import Dashboard from './Screens/Dashboard';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);

  // SignalR connection management
  useEffect(() => {
    const connectToSignalR = async () => {
      if (token && !connection) {
        try {
          const newConnection = new signalR.HubConnectionBuilder()
            .withUrl('https://localhost:7037/useractivityhub', {
              accessTokenFactory: () => token,
            })
            .withAutomaticReconnect()
            .build();

          await newConnection.start();
          console.log('SignalR Connected');
          setConnection(newConnection);
          
          // Add hub methods here
          newConnection.on("UserConnected", (userId) => {
            console.log("User connected:", userId);
          });

        } catch (error) {
          console.error('SignalR Connection Error:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    connectToSignalR();

    return () => {
      if (connection) {
        connection.stop();
        console.log('SignalR Disconnected');
      }
    };
  }, [token]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Initializing...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="w-screen h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={
            token ? <Navigate to="/dashboard" replace /> : <Login setToken={setToken} />
          } />
          
          <Route path="/dashboard" element={
            token ? (
              <Dashboard connection={connection} />
            ) : (
              <Navigate to="/" replace />
            )
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;