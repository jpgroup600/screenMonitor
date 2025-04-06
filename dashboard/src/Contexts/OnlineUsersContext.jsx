import React, { createContext, useState, useEffect, useContext } from "react";
import * as signalR from "@microsoft/signalr";

export const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  const [onlineUserIds, setOnlineUserIds] = useState([]);  // Storing user ids
  const [hubConnection, setHubConnection] = useState(null);

  // User Activity Hub Connection
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://141.164.41.199:8080/api/useractivityhub", {
        accessTokenFactory: () => localStorage.getItem("token"),
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Start connection
    connection.start()
      .then(() => {
        console.log("Connected to UserActivityHub");
        connection.invoke("GetOnlineUsers");
        setHubConnection(connection);
      })
      .catch((error) => console.error("Connection error:", error));

    // Event handlers
    connection.on("ReceiveOnlineUsers", (users) => {
      setOnlineUserIds(users.map((u) => u.key));
    });

    connection.on("UserStatusChanged", (userId, role, isOnline) => {
      setOnlineUserIds((prevIds) =>
        isOnline
          ? [...new Set([...prevIds, userId])]
          : prevIds.filter((id) => id !== userId)
      );
    });

    // Cleanup
    return () => {
      if (connection) connection.stop();
    };
  }, []);

  // Function to request screenshots from specific users
  const requestScreenshots = (userIds = []) => {

    console.log("screenshot requested")
    if (!hubConnection) {
      console.error("No active connection to hub");
      return Promise.reject("No connection");
    }

    if (userIds.length === 0) {
      // Request from all active users
      return hubConnection.invoke("RequestScreenshotsFromActiveEmployees");
    } else {
      // Request from specific users
      return Promise.all(
        userIds.map((userId) =>
          hubConnection.invoke("RequestUserScreenshot", userId)
        )
      );
    }
  };

  return (
    <OnlineUsersContext.Provider value={{ 
      onlineUserIds, 
      requestScreenshots 
    }}>
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsers = () => {
  const context = useContext(OnlineUsersContext);
  if (!context) {
    throw new Error("useOnlineUsers must be used within an OnlineUsersProvider");
  }
  return context;
};
