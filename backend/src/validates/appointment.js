import { z } from "zod";

export const appointmentSchema = {
  bookAppointment: {
    body: z.object({
      doctorId: z.string().uuid({ message: "ID bác sĩ không hợp lệ (phải là UUID)" }),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: "Ngày khám phải đúng định dạng YYYY-MM-DD",
        }),
      shift: z
        .number({ invalid_type_error: "Ca khám phải là số" })
        .int()
        .min(1, "Ca khám nhỏ nhất là 1")
        .max(12, "Ca khám lớn nhất là 12"),
      reason: z
        .string()
        .min(5, "Lý do khám quá ngắn, vui lòng mô tả chi tiết hơn")
        .optional()
        .nullable(),
    }),
  },

  getAll: {
    query: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: "Ngày phải đúng định dạng YYYY-MM-DD",
        })
        .optional(),
      status: z
        .enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"])
        .optional(),
      lastId: z.string().uuid({ message: "lastId phải là UUID" }).optional(),
      limit: z
        .string()
        .regex(/^\d+$/, { message: "Limit phải là số" })
        .optional(),
      desc: z.enum(["true", "false"]).optional(),
    }),
  },

  getSlots: {
    query: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: "Ngày khám phải đúng định dạng YYYY-MM-DD",
        }),
      doctorId: z
        .string()
        .uuid({ message: "ID bác sĩ không hợp lệ" })
        .optional(),
      specialtyId: z
        .string()
        .uuid({ message: "ID chuyên khoa không hợp lệ" })
        .optional(),
    }),
  },

  getHistory: {
    params: z.object({
      userId: z.string().uuid({ message: "ID bệnh nhân không hợp lệ" }),
    }),
    query: z.object({
      lastId: z.string().uuid({ message: "lastId phải là UUID" }).optional(),
      limit: z
        .string()
        .regex(/^\d+$/, { message: "Limit phải là số" })
        .optional(),
      desc: z
        .enum(["true", "false"], {
          message: "Desc chỉ được là 'true' hoặc 'false'",
        })
        .optional(),
    }),
  },

  getDoctorSchedule: {
    params: z.object({
      doctorId: z.string().uuid({ message: "ID bác sĩ không hợp lệ" }),
    }),
    query: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: "Ngày phải đúng định dạng YYYY-MM-DD",
        })
        .optional(),
      lastId: z.string().uuid({ message: "lastId phải là UUID" }).optional(),
      limit: z
        .string()
        .regex(/^\d+$/, { message: "Limit phải là số" })
        .optional(),
      desc: z.enum(["true", "false"]).optional(),
    }),
  },

  updateStatus: {
    params: z.object({
      appointmentId: z.string().uuid({ message: "ID lịch khám không hợp lệ" }),
    }),
    body: z.object({
      status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"], {
        errorMap: () => ({
          message:
            "Trạng thái không hợp lệ (chỉ nhận: pending, accepted, completed, cancelled)",
        }),
      }),
    }),
  },

  medicalRecord: {
    params: z.object({
      appointmentId: z.string().uuid({ message: "ID lịch khám không hợp lệ" }),
    }),
    body: z.object({
      diagnosis: z.string().min(2, "Vui lòng nhập chẩn đoán bệnh"),
      prescription: z.string().optional().nullable(),
      doctorAdvice: z.string().optional().nullable(),
    }),
  },

  checkParamId: {
    params: z.object({
      appointmentId: z.string().uuid({ message: "ID lịch khám không hợp lệ" }),
    }),
  },

  registerLeave: {
    body: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: "Ngày nghỉ phải đúng định dạng YYYY-MM-DD",
        }),

      shift: z
        .number()
        .int({ message: "Ca nghỉ phải là số nguyên" })
        .min(1, { message: "Ca nghỉ không hợp lệ (chỉ từ 1 đến 4)" })
        .max(12, { message: "Ca nghỉ không hợp lệ (chỉ từ 1 đến 4)" })
        .nullable()
        .optional(),

      reason: z
        .string()
        .trim()
        .min(5, {
          message: "Vui lòng nhập lý do nghỉ cụ thể (ít nhất 5 ký tự)",
        })
        .max(255, { message: "Lý do quá dài (tối đa 255 ký tự)" }),
    }),
  },

  cancelLeave: {
    params: z.object({
      leaveId: z.string().uuid({ message: "ID lịch nghỉ không hợp lệ" }),
    }),
  },
  getLeaves: {
    params: z.object({
      doctorId: z.string().uuid({ message: "ID bác sĩ không hợp lệ (phải là UUID)" }),
    }),
  }
};