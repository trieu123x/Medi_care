import { supabase } from "../configs/supabase-config.js";
import { profileRepository } from "../repositories/auth.js";

/**
 * Middleware xác thực JWT từ Supabase
 * Lấy Bearer token từ header Authorization, verify với Supabase
 * Gắn user vào req.user nếu hợp lệ
 */
export const authenticate = async (req, res, next) => {
  try {
    // Ưu tiên lấy token từ header Authorization (Bearer token) theo chuẩn API production
    // Nếu không có header thì mới kiểm tra trong cookie
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : req.cookies?.access_token;

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Không có token xác thực",
      });
    }



    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }

    req.user = data.user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware kiểm tra phân quyền (Role-based Authorization)
 * Yêu cầu phải chạy sau middleware authenticate
 * @param {string[]} allowedRoles - Danh sách các role được phép truy cập ('ADMIN', 'DOCTOR', 'PATIENT')
 */
export const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "Yêu cầu xác thực",
        });
      }

      // Lấy chi tiết profile từ DB để kiểm tra role
      const profile = await profileRepository.findById(req.user.id);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng",
        });
      }

      // Gắn thông tin profile vào req.user tiện cho các middleware/controller sau sử dụng
      req.user.profile = profile;

      if (profile.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "Tài khoản của bạn đã bị khóa",
        });
      }

      if (!profile.role || !allowedRoles.includes(profile.role)) {
        return res.status(403).json({
          success: false,
          message: "Không có quyền truy cập",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Các middleware tiện ích cho từng role cụ thể
export const authorizeAdmin = authorizeRoles("ADMIN");
export const authorizeDoctor = authorizeRoles("DOCTOR");
export const authorizePatient = authorizeRoles("PATIENT");
