// src/request.js
import axios from 'axios';

// Use the backend URL from the preload script
// src/request.js
const baseURL = window.backend ? window.backend.getBackendUrl() : process.env.BACKEND_URL;

// Or use async/await:
const getBackendUrl = async () => {
  try {
    return await window.backend.getBackendUrl();
  } catch (error) {
    console.error('Failed to fetch backend URL:', error);
    return process.env.BACKEND_URL; // Fallback from Webpack
  }
};

// Use in axios config
const axiosInstance = axios.create({
  baseURL: process.env.BACKEND_URL, // From Webpack (development)
});

// Optional: Add an interceptor to attach an authorization token to every request.
axiosInstance.interceptors.request.use(
  (config) => {
    // Retrieve your token here. Replace the following hard-coded token
    // with your actual token retrieval logic (e.g., from localStorage or secure storage).
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Export helper functions for each HTTP method
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

// Alternatively, you can export a default object with all methods.
const request = {
  get: getRequest,
  post: postRequest,
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
};

export default request;
