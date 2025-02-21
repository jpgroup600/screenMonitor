import React, { createContext, useState, useEffect } from "react";
import * as signalR from "@microsoft/signalr";

export const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5265/useractivityhub", {
        accessTokenFactory: () => localStorage.getItem("token"),
      })
      .withAutomaticReconnect()
      .build();

    connection
      .start()
      .then(() => {
        console.log("Connected to SignalR hub");
        connection.invoke("GetOnlineUsers");
      })
      .catch((error) => console.error("Error connecting to SignalR hub:", error));

    // Listen for the initial list of online users
    connection.on("ReceiveOnlineUsers", (users) => {
      console.log("Received online users:", users);
      setOnlineUserIds(users.map((u) => u.key));
    });

    // Listen for real-time status changes
    connection.on("UserStatusChanged", (userId, role, isOnline) => {
      console.log("User status changed:", userId, isOnline);
      setOnlineUserIds((prevIds) => {
        if (isOnline) {
          return prevIds.includes(userId) ? prevIds : [...prevIds, userId];
        } else {
          return prevIds.filter((id) => id !== userId);
        }
      });
    });

    return () => {
      connection.stop();
    };
  }, []);

  return (
    <OnlineUsersContext.Provider value={{ onlineUserIds }}>
      {children}
    </OnlineUsersContext.Provider>
  );
};
