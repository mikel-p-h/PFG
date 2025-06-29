// src/apiClient.ts
import axios from 'axios';
import qs from 'qs';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  paramsSerializer: (params) =>
    qs.stringify(params, { arrayFormat: 'repeat' }),
});

export default apiClient;
