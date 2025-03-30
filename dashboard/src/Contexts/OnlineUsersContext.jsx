import React, { createContext, useState, useEffect, useContext } from "react";
import * as signalR from "@microsoft/signalr";

export const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [screenHubConnection, setScreenHubConnection] = useState(null);

  // User Activity Hub Connection
  useEffect(() => {
    const userActivityConnection = new signalR.HubConnectionBuilder()
      .withUrl("http://141.164.41.199:8080/api/useractivityhub", {
        accessTokenFactory: () => localStorage.getItem("token"),
      })
      .withAutomaticReconnect()
      .build();

    userActivityConnection
      .start()
      .then(() => {
        console.log("Connected to User Activity Hub");
        userActivityConnection.invoke("GetOnlineUsers");
      })
      .catch((error) => console.error("User Activity Hub connection error:", error));

    userActivityConnection.on("ReceiveOnlineUsers", (users) => {
      setOnlineUserIds(users.map((u) => u.key));
    });

    userActivityConnection.on("UserStatusChanged", (userId, role, isOnline) => {
      setOnlineUserIds((prevIds) => 
        isOnline 
          ? [...new Set([...prevIds, userId])] 
          : prevIds.filter((id) => id !== userId)
      );
    });

    return () => userActivityConnection.stop();
  }, []);

  // Screen Hub Connection
  useEffect(() => {
    const screenConnection = new signalR.HubConnectionBuilder()
      .withUrl("http://141.164.41.199:8080/api/screenHub", {
        accessTokenFactory: () => localStorage.getItem("token"),
      })
      .withAutomaticReconnect()
      .build();

    screenConnection
      .start()
      .then(() => {
        console.log("Connected to Screen Hub");
        setScreenHubConnection(screenConnection);
      })
      .catch((error) => console.error("Screen Hub connection error:", error));

    return () => screenConnection.stop();
  }, []);

  return (
    <OnlineUsersContext.Provider value={{ 
      onlineUserIds, 
      screenHubConnection 
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