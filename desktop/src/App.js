import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import Login from './Screens/Login';
import Dashboard from './Screens/Dashboard';
import SessionStarted from './Screens/SessionStarted';
import CustomTitleBar from './Components/CustomTitleBar';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [connection, setConnection] = useState(null); // useractivityhub connection
  const [screenHubConnection, setScreenHubConnection] = useState(null); // screenhub connection
  const [loading, setLoading] = useState(true);

  const baseURL = window.backend ? window.backend.getBackendUrl() : process.env.BACKEND_URL;

  useEffect(() => {
    const connectUserActivityHub = async () => {
      if (token && !connection) {
        try {
          const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`http://141.164.41.199:8080/api/useractivityhub`, {
              accessTokenFactory: () => token,
            })
            .withAutomaticReconnect()
            .build();
    
          await newConnection.start();
          console.log('UserActivityHub connected');
          setConnection(newConnection);
    
          console.log('Connection state:', newConnection.state);
    
          newConnection.on("UserConnected", (userId) => {
            console.log("User connected:", userId); 
          });
    
          newConnection.on("RequestScreenshot", () => {
            window?.electronAPI?.captureScreenshot(); 
          });
    
        } catch (error) {
          console.error('UserActivityHub connection error:', error);
          setToken(null);
        }
      }
    };
    


    const connectAll = async () => {
      await Promise.all([connectUserActivityHub()]);
      setLoading(false);
    };

    connectAll();

    return () => {
      if (connection) {
        connection.stop();
        console.log('UserActivityHub disconnected');
      }
      if (screenHubConnection) {
        screenHubConnection.stop();
        console.log('ScreenHub disconnected');
      }
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl text-gray-600">Initializing...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="w-screen h-screen bg-gray-50">
        <CustomTitleBar />
        <Routes>
          <Route
            path="/"
            element={
              token ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login setToken={setToken} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              token ? (
                <Dashboard connection={connection} screenHub={screenHubConnection} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/sessionStarted"
            element={token ? <SessionStarted /> : <Navigate to="/" replace />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
