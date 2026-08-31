import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import Login from './Screens/Login';
import Dashboard from './Screens/Dashboard';
import SessionStarted from './Screens/SessionStarted';
import CustomTitleBar from './Components/CustomTitleBar';
import { native } from './native';
import { initializeAuthToken } from './authToken';
import { installAvailableUpdate } from './autoUpdate';

const App = () => {
  const [token, setToken] = useState(null);
  const [connection, setConnection] = useState(null); // useractivityhub connection
  const [screenHubConnection, setScreenHubConnection] = useState(null); // screenhub connection
  const [loading, setLoading] = useState(true);

  const hubURL = import.meta.env.VITE_HUB_URL;

  useEffect(() => {
    if (import.meta.env.PROD) {
      installAvailableUpdate().catch((error) => console.error('Automatic update failed:', error));
    }
  }, []);

  useEffect(() => {
    initializeAuthToken({ native, storage: localStorage })
      .then((value) => setToken(value || null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const connectUserActivityHub = async () => {
      if (token && !connection) {
        try {
          if (!hubURL) {
            throw new Error('HUB_URL is not configured');
          }

          const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubURL, {
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
            native.captureScreenshot().catch(console.error);
          });
    
        } catch (error) {
          console.error('UserActivityHub connection error:', error);
        }
      }
    };
    


    const connectAll = async () => {
      await Promise.all([connectUserActivityHub()]);
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
  }, [token, hubURL]);

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
                <Dashboard connection={connection} screenHub={screenHubConnection} token={token} setToken={setToken} />
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
