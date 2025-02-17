import React, { useContext, useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { OnlineUsersContext } from "../../Contexts/OnlineUsersContext";
import request from "../../Actions/request"; 
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register chart components
ChartJS.register(ArcElement, Tooltip, Legend);

const Users = () => {
  const { onlineUserIds } = useContext(OnlineUsersContext);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch total employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const data = await request.get("/admin/only-employees");
        setEmployees(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const totalEmployees = employees.length;
  const onlineCount = onlineUserIds.length;
  const offlineCount = totalEmployees - onlineCount;

  // Setup chart data & options
  const data = {
    labels: ["Online", "Offline"],
    datasets: [
      {
        data: [onlineCount, offlineCount > 0 ? offlineCount : 0],
        backgroundColor: ["#ffffff", "rgba(255,255,255,0.4)"],
        borderColor: ["#ffffff", "#ffffff"],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        labels: {
          color: "#ffffff",
          font: {
            size: 14,
          },
        },
      },
    },
  };

  return (
    <div
      style={{
        backgroundColor: "#0068f7",
        padding: "20px",
        borderRadius: "8px",
        textAlign: "center",
        color: "#ffffff",
        maxWidth: "400px",
        margin: "0 auto",
      }}
    >
      <h2>Users Online</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>
            <strong>{onlineCount}</strong> online out of{" "}
            <strong>{totalEmployees}</strong> users.
          </p>
          <div style={{ maxWidth: "300px", margin: "0 auto" }}>
            <Doughnut data={data} options={options} />
          </div>
        </>
      )}
    </div>
  );
};

export default Users;
