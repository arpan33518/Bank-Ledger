import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
});


export const attachTokenInterceptor = (
  getToken: () => Promise<string | null>
) => {
  axiosInstance.interceptors.request.use(
    async (config) => {
      const token = await getToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    }
  );
};

