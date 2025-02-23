import axios, { AxiosResponse } from 'axios';
import { TOKEN_NAME, VITE_API_URL } from '../../config';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: VITE_API_URL, // Replace with your API base URL
  timeout: 10000, // Set request timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Add a request interceptor
apiClient.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem(TOKEN_NAME); // Replace with your token logic
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  async (error: any) => {
    const config = error.config;
    config.retryCount = config.retryCount || 0;

    if (config.retryCount < MAX_RETRIES) {
      config.retryCount += 1;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return apiClient(config);
    }
    return Promise.reject(error);
  }
);

// Add a response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: any) => {
    const config = error.config;
    config.retryCount = config.retryCount || 0;

    if (error.response?.status === 401) {
      // Handle unauthorized access, e.g., logout user
      console.error('Unauthorized! Redirecting to login...');
      localStorage.removeItem(TOKEN_NAME); // Clear token
      window.location.href = '/login'; // Redirect to login page
      return Promise.reject(error);
    }

    if (config.retryCount < MAX_RETRIES) {
      config.retryCount += 1;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return apiClient(config);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
