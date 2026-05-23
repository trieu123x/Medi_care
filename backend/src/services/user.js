import { userRepository } from "../repositories/user.js";
import { uploadHelper } from "../helpers/storage-helper.js";
import { prisma } from "../configs/prisma-config.js";

export const userService = {
  getTotalCount: async () => {
    return await userRepository.countAll();
  },

  getUsersForAdmin: async (filters) => {
    return await userRepository.findAllForAdmin(filters);
  },

  getAllUsers: async (requesterRole, page = 1, limit = 10) => {
    let filters = {};

    if (requesterRole === "DOCTOR") {
      // Doctor can access all patients
      filters.role = "PATIENT";
    } else if (requesterRole === "ADMIN") {
      // Admin can access all profiles, no filter needed
    } else {
      // Others (patient or undefined) are not allowed
      throw Object.assign(
        new Error("Không có quyền truy cập danh sách người dùng"),
        { statusCode: 403 },
      );
    }

    const skip = (page - 1) * limit;
    const { users, total } = await userRepository.findAll(filters, skip, limit);

    return {
      users,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getUserById: async (id, requesterRole, requesterId) => {
    const user = await userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    // Logic check:
    // Admin: Can view anyone
    // Doctor: Can view doctors and patients (Prompt: "nếu là dortor thì cũng xem đc thông tin cụ thể của patient") -> basically anyone
    // Patient: Can view doctors, and themselves. Cannot view other patients.
    if (requesterRole === "PATIENT") {
      if (user.role !== "DOCTOR" && user.id !== requesterId) {
        throw Object.assign(
          new Error("Không có quyền xem thông tin người dùng này"),
          { statusCode: 403 },
        );
      }
    }

    return user;
  },

  updateUser: async (id, requesterId, updateData, file) => {
    // Only allow self-updating
    if (id !== requesterId) {
      throw Object.assign(
        new Error("Chỉ có thể cập nhật thông tin của chính mình"),
        { statusCode: 403 },
      );
    }

    // Filter out fields that shouldn't be updated here directly (like role, id, relational fields)
    const {
      role,
      id: profileId,
      createdAt,
      doctor,
      degreeId,
      specialtyId,
      experience,
      education,
      achievements,
      avatarCropData,
      ...allowedData
    } = updateData;

    // Parse dob to Date if provided as string
    if (allowedData.dob) {
      allowedData.dob = new Date(allowedData.dob);
    }
    
    if (avatarCropData !== undefined) {
      if (typeof avatarCropData === "string") {
        try {
          allowedData.avatarCropData = JSON.parse(avatarCropData);
        } catch {
          allowedData.avatarCropData = null;
        }
      } else {
        allowedData.avatarCropData = avatarCropData;
      }
    }

    if (file) {
      const existingUser = await userRepository.findById(id);
      if (existingUser && existingUser.avatarUrl) {
        try {
          await uploadHelper.deleteFile(existingUser.avatarUrl, "medicare");
        } catch (e) {
          console.error("Lỗi xóa ảnh cũ:", e);
        }
      }
      const imageUrl = await uploadHelper.uploadFile(file, "medicare", "users");
      allowedData.avatarUrl = imageUrl;
    } else if (allowedData.avatarUrl) {
      const existingUser = await userRepository.findById(id);
      if (
        existingUser &&
        existingUser.avatarUrl &&
        existingUser.avatarUrl !== allowedData.avatarUrl
      ) {
        try {
          await uploadHelper.deleteFile(existingUser.avatarUrl, "medicare");
        } catch (e) {
          console.error("Lỗi xóa ảnh cũ:", e);
        }
      }
    }

    const doctorData = {};
    if (degreeId !== undefined)
      doctorData.degreeId = degreeId === "" ? null : degreeId;
    if (specialtyId !== undefined)
      doctorData.specialtyId = specialtyId === "" ? null : specialtyId;
    if (experience !== undefined) doctorData.experience = experience;
    if (education !== undefined) doctorData.education = education;
    if (achievements !== undefined) doctorData.achievements = achievements;

    const updatedUser = await userRepository.update(
      id,
      allowedData,
      Object.keys(doctorData).length > 0 ? doctorData : null,
    );
    return updatedUser;
  },

  toggleBlockUser: async (id, isActive) => {
    const user = await userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    return await userRepository.update(id, { isActive: !!isActive });
  },

  deleteUser: async (id) => {
    const user = await userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    // Xóa cascade thủ công các bảng không có onDelete: Cascade trong schema
    // 1. Xóa notifications liên quan đến appointments của user
    if (id) {
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { userId: String(id) },
            { appointment: { OR: [{ patientId: String(id) }, { doctorId: String(id) }] } },
          ],
        },
      });
    }

    // 2. Xóa medical records liên quan đến appointments của user
    await prisma.medicalRecord.deleteMany({
      where: {
        appointment: {
          OR: [{ patientId: id }, { doctorId: id }],
        },
      },
    });

    // 3. Xóa appointments của user (với tư cách bệnh nhân hoặc bác sĩ)
    await prisma.appointment.deleteMany({
      where: {
        OR: [{ patientId: id }, { doctorId: id }],
      },
    });

    // 4. Thử xóa tài khoản khỏi Supabase Auth
    try {
      const { supabaseAdmin } = await import("../configs/supabase-config.js");
      if (supabaseAdmin) {
        await supabaseAdmin.auth.admin.deleteUser(id);
      }
    } catch (err) {
      console.error(
        "Supabase Admin user deletion failed or not configured:",
        err.message,
      );
    }

    // 5. Xóa profile (Doctor, DoctorLeave, Notification cá nhân sẽ cascade tự động)
    return await userRepository.delete(id);
  },
};
