import axios from 'axios';

// Định cấu hình URL gốc của API.
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;

// --- Cookie Helpers ---
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

/**
 * Lưu một giá trị vào cookie phía client.
 * @param {string} name  - Tên cookie
 * @param {string} value - Giá trị
 * @param {number} days  - Số ngày hết hạn
 */
const setCookie = (name, value, days) => {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const sameSite = isHttps ? 'None' : 'Lax';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=${sameSite}${secure}`;
};

/**
 * Xóa cookie phía client.
 * @param {string} name - Tên cookie cần xóa
 */
const removeCookie = (name) => {
  if (typeof document === 'undefined') return;
  const sameSite = isHttps ? 'None' : 'Lax';
  const secure = isHttps ? '; Secure' : '';
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=${sameSite}${secure}`;
};

/**
 * Lưu cả access_token và refresh_token vào localStorage + cookie.
 */
const saveTokens = (accessToken, refreshToken) => {
  if (!accessToken) return;
  localStorage.setItem('access_token', accessToken);
  setCookie('access_token', accessToken, 7);
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
    setCookie('refresh_token', refreshToken, 30);
  }
};

/**
 * Xóa token khỏi localStorage + cookie.
 */
const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  removeCookie('access_token');
  removeCookie('refresh_token');
};

// Xuất helpers để dùng ở nơi khác (ví dụ: login page, auth store)
export { saveTokens, clearTokens, setCookie, removeCookie };

// ---------------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true, // Gửi cookie đính kèm request
});

// Interceptor cho Request: tự động gắn access_token vào header
axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
      const refreshTokenValue = localStorage.getItem('refresh_token');

      // Nếu không có refresh token → xóa hết và về login
      if (!refreshTokenValue) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

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
        const res = await axios.post(
          `${API_URL}/auth/refresh-token`,
          { refreshToken: refreshTokenValue },
          { withCredentials: true }
        );

        const { accessToken, refreshToken: newRefreshToken } = res.data;

        // Lưu token mới vào cả localStorage lẫn cookie
        saveTokens(accessToken, newRefreshToken);

        // Cập nhật header mặc định
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        // Xử lý hàng đợi
        processQueue(null, accessToken);

        // Retry request gốc với token mới
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh token cũng hết hạn → bắt buộc đăng nhập lại
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
