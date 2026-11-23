import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for logging in development
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful error capture
    const message = error.response?.data?.detail || error.message || 'Unknown network error';
    return Promise.reject(new Error(message));
  }
);
