// src/request.js
import axios from 'axios';
import { native } from '../native';

const baseURL = import.meta.env.VITE_BACKEND_URL;

// Use in axios config
const axiosInstance = axios.create({
  baseURL,
});

// Optional: Add an interceptor to attach an authorization token to every request.
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await native.loadAuthToken();
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
