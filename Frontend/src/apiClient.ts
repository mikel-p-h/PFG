// src/apiClient.ts
import axios from 'axios';
import qs from 'qs';

const apiClient = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',  //No parece que funcione con la url api:8000
  baseURL: 'http://localhost:8000',
  paramsSerializer: (params) =>
    qs.stringify(params, { arrayFormat: 'repeat' }),  // Esto es lo importante para el filtro de estados
});

export default apiClient;
