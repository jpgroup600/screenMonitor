// src/request.js
import axios from 'axios';

// Access the Vite environment variable
const baseURL = import.meta.env.VITE_BACKEND_URL;

if (!baseURL) {
  console.warn('Backend URL is not defined. Please set VITE_BACKEND_URL in your .env file.');
}

const axiosInstance = axios.create({
  baseURL,
  // Add any other global settings here, e.g. timeout
});

// Optional: Add an interceptor to attach an authorization token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = "eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6Ijg0OGFhYTZiLTNlYzgtNGIwMi1iZjQzLWQ0OGZlNzNlOTQxMCIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6ImphbmVkb2VAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQWRtaW4iLCJleHAiOjE3NDEyNzUwMTQsImlzcyI6InNlaGF0bWFuZC5wayJ9.rNHftScIGrtjv3QHeU3zxqxtTPvl4uQxJ8QQU1xqkWV15qukaig7gFfYi9P0AnzkSEp6cK3q0Z1w3pglHJzboA"; // Or wherever you store your token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Export helper functions for each HTTP method, if needed.
export const getRequest = async (url, config = {}) => {
  const response = await axiosInstance.get(url, config);
  return response.data;
};

export const postRequest = async (url, data, config = {}) => {
  const response = await axiosInstance.post(url, data, config);
  return response.data;
};

export const putRequest = async (url, data, config = {}) => {
  const response = await axiosInstance.put(url, data, config);
  return response.data;
};

export const patchRequest = async (url, data, config = {}) => {
  const response = await axiosInstance.patch(url, data, config);
  return response.data;
};

export const deleteRequest = async (url, config = {}) => {
  const response = await axiosInstance.delete(url, config);
  return response.data;
};

// You can also export a default object with all these methods.
const request = {
  get: getRequest,
  post: postRequest,
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
};

export default request;
