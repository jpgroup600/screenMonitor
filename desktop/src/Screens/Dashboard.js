// src/Screens/Dashboard.jsx
import React from "react";
import { useState,useEffect } from "react";
import request from "../Actions/request";

const Dashboard = () => {

  const [userId,setUserId] = useState();

  useEffect(()=>{
    try{
      const response = request.get("/employee/current-user-id");
      setUserId(response);
      console.log(`Reponse Successful: ${userId}`)
    }catch(error){
      console.log(error)
      console.log(`Response: ${JSON.stringify(response)}`)
    }
  },[])

  return (
    <div className="w-full h-full p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>Welcome to the dashboard!</p>
    </div>
  );
};

export default Dashboard;
