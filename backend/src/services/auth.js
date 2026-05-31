import { supabase } from "../configs/supabase-config.js";
import { profileRepository } from "../repositories/auth.js";
import { uploadHelper } from "../helpers/storage-helper.js";
import { sendOtpEmail } from "./mail.js";
import crypto from "crypto";

// In-memory OTP store: email -> { otp, expiresAt }
const otpStore = new Map();

// In-memory OTP store cho Đăng ký: email -> { otp, expiresAt, data: { password, fullName, phone } }
const registerOtpStore = new Map();

export const authService = {
  /**
   * Tạo tài khoản bác sĩ (không cần gửi email OTP)
   */
  registerDoctor: async ({ email, fullName, phone, file, avatarCropData }) => {
    // 1. Kiểm tra phone
    const existingPhone = await profileRepository.findByPhone(phone);
    if (existingPhone) {
      throw Object.assign(new Error("Số điện thoại đã được sử dụng"), { statusCode: 409 });
    }

    if (email) {
      const existingEmail = await profileRepository.findByEmail(email);
      if (existingEmail) {
        throw Object.assign(new Error("Email đã được sử dụng"), { statusCode: 409 });
      }
    }

    // 2. Tạo user trên Supabase Auth với password mặc định
    const { supabaseAdmin } = await import("../configs/supabase-config.js");
    if (!supabaseAdmin) {
      throw Object.assign(new Error("Cần cấu hình SUPABASE_SERVICE_ROLE_KEY"), { statusCode: 500 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "medicare",
      user_metadata: { full_name: fullName, phone },
      email_confirm: true,
      phone_confirm: true,
    });

    if (authError) {
      throw Object.assign(new Error(authError.message), { statusCode: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw Object.assign(new Error("Không thể tạo tài khoản"), { statusCode: 500 });
    }

    // 3. Upload avatar nếu có
    let avatarUrl = null;
    if (file) {
      avatarUrl = await uploadHelper.uploadFile(file, 'medicare', 'users');
    }

    // 4. Record profile
    const { prisma } = await import("../configs/prisma-config.js");
    const profile = await prisma.profile.create({
      data: {
        id: userId,
        fullName,
        email: email,
        phone,
        role: "DOCTOR",
        avatarUrl,
        avatarCropData: avatarCropData ? JSON.parse(avatarCropData) : null
      }
    });

    return {
      userId: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      role: profile.role
    };
  },

  /**
   * Đăng ký tài khoản mới
   * - Tạo user trên Supabase Auth
   * - Tạo profile trong bảng profiles (Prisma)
   */
  register: async ({ email, password, fullName, phone }) => {
    // 1. Kiểm tra phone đã tồn tại chưa
    const existingProfile = await profileRepository.findByPhone(phone);
    if (existingProfile) {
      throw Object.assign(new Error("Số điện thoại đã được sử dụng"), {
        statusCode: 409,
      });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingEmail = await profileRepository.findByEmail(email);
    if (existingEmail) {
      throw Object.assign(new Error("Email đã được sử dụng"), {
        statusCode: 409,
      });
    }

    // Sinh OTP 6 chữ số (FIX CỨNG 123456 ĐỂ TEST)
    const otp = "123456"; // crypto.randomInt(100000, 999999).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 phút

    // Lưu thông tin đăng ký vào bộ nhớ tạm
    registerOtpStore.set(email, {
      otp,
      expiresAt,
      data: { password, fullName, phone },
    });

    // TẮT gửi email OTP lúc test
    // await sendOtpEmail(email, otp)
    console.log(`[TEST OTP] Mã đăng ký của email ${email}: ${otp}`);

    return { email };
  },

  /**
   * Xác minh OTP đăng ký và tạo tài khoản thực tế
   */
  verifyRegister: async ({ email, otp }) => {
    const record = registerOtpStore.get(email);

    if (!record) {
      throw Object.assign(
        new Error("Tài khoản chưa được đăng ký hoặc OTP chưa được yêu cầu"),
        { statusCode: 400 },
      );
    }
    if (Date.now() > record.expiresAt) {
      registerOtpStore.delete(email);
      throw Object.assign(new Error("OTP đã hết hạn, vui lòng đăng ký lại"), {
        statusCode: 400,
      });
    }
    if (record.otp !== otp) {
      throw Object.assign(new Error("OTP không đúng"), { statusCode: 400 });
    }

    const { password, fullName, phone } = record.data;

    // Tạo user trên Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });

    if (authError) {
      throw Object.assign(new Error(authError.message), { statusCode: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw Object.assign(new Error("Không thể tạo tài khoản"), {
        statusCode: 500,
      });
    }

    // Tạo profile trong DB
    const profile = await profileRepository.create({
      id: userId,
      fullName,
      email,
      phone,
      role: "PATIENT",
    });

    // Xóa thông tin tạm
    registerOtpStore.delete(email);

    return {
      userId: profile.id,
      fullName: profile.fullName,
      phone: profile.phone,
      role: profile.role,
      email: authData.user.email,
    };
  },

  /**
   * Đăng nhập
   * - Xác thực qua Supabase Auth (email/password)
   * - Trả về session token + thông tin profile
   */
  login: async ({ email, password }) => {
    // 1. Xác thực với Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      throw Object.assign(new Error("Email hoặc mật khẩu không đúng"), {
        statusCode: 401,
      });
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw Object.assign(new Error("Đăng nhập thất bại"), { statusCode: 500 });
    }

    // 2. Lấy thông tin profile từ DB
    const profile = await profileRepository.findById(userId);
    if (!profile) {
      throw Object.assign(new Error("Tài khoản không tồn tại trong hệ thống"), {
        statusCode: 404,
      });
    }

    // Kiểm tra trạng thái hoạt động
    if (profile.isActive === false) {
      throw Object.assign(new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản lý."), {
        statusCode: 403,
      });
    }

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        userId: profile.id,
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        email: authData.user.email,
        isActive: profile.isActive
      },
    };
  },

  /**
   * Đăng xuất - vô hiệu hóa session hiện tại trên Supabase
   */
  logout: async (accessToken) => {
    // Gán token vào session rồi sign out
    const { error } = await supabase.auth.admin.signOut(accessToken);
    if (error) {
      throw Object.assign(new Error("Đăng xuất thất bại"), { statusCode: 500 });
    }
    return true;
  },

  /**
   * Lấy thông tin user hiện tại từ token
   */
  getMe: async (userId) => {
    const profile = await profileRepository.findById(userId);
    if (!profile) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }
    return {
      ...profile,
      isActive: profile.isActive
    };
  },

  /**
   * Gửi OTP đặt lại mật khẩu về email đăng ký
   */
  forgotPassword: async ({ email }) => {
    // Kiểm tra email có tồn tại trong profiles không
    const profile = await profileRepository.findByEmail(email);
    if (!profile) {
      throw Object.assign(new Error("Email không tồn tại trong hệ thống"), {
        statusCode: 404,
      });
    }

    // Sinh OTP 6 chữ số (FIX CỨNG 123456 ĐỂ TEST)
    const otp = "123456"; // crypto.randomInt(100000, 999999).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 phút

    otpStore.set(email, { otp, expiresAt });

    // TẮT gửi email quên mật khẩu lúc test
    // await sendOtpEmail(email, otp)
    console.log(`[TEST OTP] Mã reset mật khẩu của email ${email}: ${otp}`);

    return { message: "OTP đã được gửi đến email của bạn" };
  },

  /**
   * Xác minh OTP và đặt lại mật khẩu mới
   */
  resetPassword: async ({ email, otp, newPassword }) => {
    const record = otpStore.get(email);

    if (!record) {
      throw Object.assign(
        new Error("OTP không hợp lệ hoặc chưa được yêu cầu"),
        { statusCode: 400 },
      );
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      throw Object.assign(new Error("OTP đã hết hạn, vui lòng yêu cầu lại"), {
        statusCode: 400,
      });
    }
    if (record.otp !== otp) {
      throw Object.assign(new Error("OTP không đúng"), { statusCode: 400 });
    }

    // OTP hợp lệ — xóa khỏi store
    otpStore.delete(email);

    // Dùng Supabase Admin để cập nhật mật khẩu
    const { supabaseAdmin } = await import("../configs/supabase-config.js");
    if (!supabaseAdmin) {
      throw Object.assign(new Error("Cần cấu hình SUPABASE_SERVICE_ROLE_KEY"), {
        statusCode: 500,
      });
    }

    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();
    if (listError)
      throw Object.assign(new Error(listError.message), { statusCode: 500 });

    const user = users.users.find((u) => u.email === email);
    if (!user)
      throw Object.assign(new Error("Không tìm thấy tài khoản"), {
        statusCode: 404,
      });

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });
    if (updateError)
      throw Object.assign(new Error(updateError.message), { statusCode: 400 });

    return { message: "Đặt lại mật khẩu thành công" };
  },
};