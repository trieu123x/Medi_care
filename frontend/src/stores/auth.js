import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import axiosInstance from '@/utils/axios'
import { clearTokens } from '@/utils/axios'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isLogin: false,
      isAdmin: false,
      isDoctor: false,
      isLoading: true, 

      setUser: (userData) => {
        if (userData) {
          const role = userData.role?.toLowerCase() || '';
          set({
            user: userData,
            isLogin: true,
            isAdmin: role === 'admin',
            isDoctor: role === 'doctor',
            isLoading: false
          })
        } else {
          set({
            user: null,
            isLogin: false,
            isAdmin: false,
            isDoctor: false,
            isLoading: false
          })
        }
      },

      logout: () => {
        clearTokens(); // Xóa token khỏi cả localStorage lẫn cookie
        set({
          user: null,
          isLogin: false,
          isAdmin: false,
          isDoctor: false,
          isLoading: false
        })
      },

      updateUser: (partialUser) => {
        const currentUser = get().user;
        if (!currentUser) return;
        set({
          user: { ...currentUser, ...partialUser }
        });
      },

      fetchUser: async () => {
        const isLogin = get().isLogin;
        
        if (!isLogin) {
          set({ isLoading: false, user: null });
          return;
        }

        try {
          const res = await axiosInstance.get("/auth/me");
          if (res && res.data) {
            const role = res.data.role?.toLowerCase() || '';
            set({
              user: res.data,
              isLogin: true,
              isAdmin: role === 'admin',
              isDoctor: role === 'doctor',
              isLoading: false
            });
          } else {
            // Nếu response thành công nhưng không có data (hiếm gặp)
            set({ isLoading: false });
          }
        } catch (error) {
          console.error("Fetch user error:", error);
          // Chỉ logout nếu lỗi là do token hết hạn hoặc không hợp lệ (401)
          if (error.response?.status === 401) {
             get().logout();
          }
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'auth-storage', // tên khóa trong localStorage
      storage: createJSONStorage(() => localStorage),
      // Chỉ lưu các trường cần thiết, không lưu trạng thái loading
      partialize: (state) => ({ 
        user: state.user, 
        isLogin: state.isLogin, 
        isAdmin: state.isAdmin, 
        isDoctor: state.isDoctor 
      }),
    }
  )
)