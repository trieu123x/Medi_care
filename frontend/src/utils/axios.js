import axios from 'axios';

// Định cấu hình URL gốc của API.
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;

// --- In-Memory Token Storage ---
let inMemoryAccessToken = null;

/**
 * Lưu access_token vào bộ nhớ RAM tạm thời.
 */
const saveTokens = (accessToken) => {
  if (!accessToken) return;
  inMemoryAccessToken = accessToken;
};

/**
 * Xóa token khỏi bộ nhớ RAM.
 */
const clearTokens = () => {
  inMemoryAccessToken = null;
};

// Xuất helpers để dùng ở nơi khác (ví dụ: login page, auth store)
export { saveTokens, clearTokens };

// ---------------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true, // Gửi cookie đính kèm request
});

// Interceptor cho Request: tự động gắn access_token vào header
axiosInstance.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Token Refresh Logic ---
let isRefreshing = false;
let failedQueue = []; // Hàng đợi các request bị lỗi 401

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor cho Response: tự động refresh token khi hết hạn
axiosInstance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Chỉ xử lý lỗi 401 và chưa retry lần nào (không áp dụng cho api login)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== 'undefined' &&
      !originalRequest?.url?.includes('/auth/login')
    ) {
      // Nếu đang refresh thì đưa request vào hàng đợi chờ
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Bắt đầu refresh token
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gửi request làm mới token. 
        // Trình duyệt sẽ tự động đính kèm cookie HttpOnly refresh_token nhờ withCredentials
        const res = await axios.post(
          `${API_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = res.data;

        // Lưu token mới vào bộ nhớ RAM
        saveTokens(accessToken);

        // Cập nhật header mặc định cho axiosInstance
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        // Xử lý hàng đợi
        processQueue(null, accessToken);

        // Retry request gốc với token mới
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh token cũng hết hạn hoặc lỗi → bắt buộc đăng nhập lại
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
