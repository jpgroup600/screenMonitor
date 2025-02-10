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
    const token = localStorage.getItem('token')
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
