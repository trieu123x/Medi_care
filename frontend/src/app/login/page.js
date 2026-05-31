"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { saveTokens } from "@/utils/axios";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routers";

import { useAuthStore } from "@/stores/auth";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setUser } = useAuthStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });

      // Axios Instance đã trả về trực tiếp response.data, nên res lúc này là object { success, message, data, accessToken }
      const userData = res?.data;
      const accessToken = res?.accessToken;

      // Lưu token vào bộ nhớ RAM tạm thời
      saveTokens(accessToken);

      console.log("Thông tin user sau khi đăng nhập:", userData);

      setUser(userData);

      window.location.href = ROUTES.HOME;

    } catch (err) {
      setError(err.response?.data?.message + "!" || "Email or password failed!");
      setTimeout(() => setError(""), 3000)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4 rasa-font">
      <div className="bg-white p-10 md:p-12 rounded-lg shadow-[0_0_10px_rgb(0,0,0,0.2)] w-full max-w-md">
        <h1 className="text-[36px] font-extrabold text-center mb-6">Đăng nhập</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            {error && <p className="absolute -top-4 text-red-500 text-xs font-semibold mb-2">{error}</p>}
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 transition-colors pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-end mt-1">
              <Link href={ROUTES.FORGET_PASSWORD} className="text-xs text-blue-500 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer bg-[#070575] text-white py-3 rounded-lg font-bold hover:bg-[#110d9e] transition-colors disabled:opacity-70 mt-2"
          >
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>

        <div className="mt-5 text-center font-medium">
          <p className="text-black text-[20px] leading-none">Chưa có tài khoản?</p>
          <Link href={ROUTES.REGISTER} className="text-blue-500 hover:underline tracking-tight text-xs block mt-1">
            Bấm vào đây để đăng ký!
          </Link>
        </div>
      </div>
    </div>
  );
}