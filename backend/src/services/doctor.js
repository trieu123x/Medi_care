import { doctorRepository } from "../repositories/doctor.js"
import { eventService } from "./event.js"
import axios from "axios"

export const doctorService = {
    getAllDoctors: async (page = 1, limit = 10, { name, specialtyId } = {}) => {
        const skip = (page - 1) * limit

        const filters = {}
        if (name) {
            filters.profile = {
                fullName: { contains: name, mode: 'insensitive' }
            }
        }
        if (specialtyId) {
            filters.specialtyId = specialtyId
        }

        const { doctors, total } = await doctorRepository.findAllDoctors(filters, skip, limit)

        return {
            doctors,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit)
            }
        }
    },

    getDoctorById: async (id, userId = null) => {
        const doctor = await doctorRepository.findDoctorById(id)
        if (!doctor) {
            throw Object.assign(new Error("Không tìm thấy thông tin bác sĩ"), { statusCode: 404 })
        }
        
        // Track sự kiện xem chi tiết bác sĩ
        if (userId) {
            eventService.track(userId, 'VIEW_DOCTOR', id)
        }
        
        return doctor
    },

    updateDoctorInfo: async (doctorId, requesterId, updateData) => {
        // Only allow self-updating
        if (doctorId !== requesterId) {
            throw Object.assign(new Error("Chỉ có thể cập nhật thông tin của chính mình"), { statusCode: 403 })
        }

        // Filter out fields that shouldn't be updated here directly
        const { id, profile, specialty, ...allowedData } = updateData;

        const updatedDoctor = await doctorRepository.updateDoctorInfo(doctorId, allowedData)

        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
            const res = await axios.post(`${AI_SERVICE_URL}/ai/disease/doctor`, {
                name: updatedDoctor.profile.fullName,
                specialty: updatedDoctor.specialty?.name || "",
                experience: updatedDoctor.experience || "",
                education: updatedDoctor.education || ""
            })
            const chunks = res.data?.chunks
            if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                await doctorRepository.createChunks(doctorId, chunks)
            }
        } catch (error) {
            console.error("Lỗi cập nhật Embedding Chunks cho Bác sĩ:", error.message)
        }

        return updatedDoctor
    },

    createDoctor: async (data) => {
        const { email, password, fullName, phone, specialtyId, degree, experience, education, achievements } = data;

        let userId;

        // 1. Create Supabase Auth User if not existing
        if (email && password) {
            const { supabaseAdmin } = await import("../configs/supabase-config.js")
            if (!supabaseAdmin) {
                throw Object.assign(new Error("Cần cấu hình SUPABASE_SERVICE_ROLE_KEY để tạo tài khoản."), { statusCode: 500 })
            }

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName, phone }
            })

            if (authError) {
                throw Object.assign(new Error(authError.message), { statusCode: 400 })
            }
            userId = authData.user.id;
        } else {
            throw Object.assign(new Error("Yêu cầu email và password để tạo tài khoản bác sĩ."), { statusCode: 400 })
        }

        const { prisma } = await import("../configs/prisma-config.js")

        // 2. Transact Profile creation and Doctor creation
        const newDoctor = await prisma.$transaction(async (tx) => {
            await tx.profile.create({
                data: {
                    id: userId,
                    fullName,
                    phone: phone || "",
                    role: "doctor"
                }
            })

            return await tx.doctor.create({
                data: {
                    id: userId,
                    specialtyId,
                    degree,
                    experience,
                    education,
                    achievements
                },
                include: {
                    profile: true,
                    specialty: true
                }
            })
        })

        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
            const res = await axios.post(`${AI_SERVICE_URL}/ai/disease/doctor`, {
                name: newDoctor.profile.fullName,
                specialty: newDoctor.specialty?.name || "",
                experience: newDoctor.experience || "",
                education: newDoctor.education || ""
            })
            const chunks = res.data?.chunks
            if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                await doctorRepository.createChunks(newDoctor.id, chunks)
            }
        } catch (error) {
            console.error("Lỗi tạo Embedding Chunks cho Bác sĩ:", error.message)
        }

        return newDoctor;
    },

    updateDoctorByAdmin: async (doctorId, updateData) => {
        // Full access without self check
        const { id, profile, specialty, ...allowedData } = updateData;

        // Attempt to find or bypass (since Prisma throws if not found sometimes, but let repository handle it)
        const updatedDoctor = await doctorRepository.updateDoctorInfo(doctorId, allowedData)

        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
            const res = await axios.post(`${AI_SERVICE_URL}/ai/disease/doctor`, {
                name: updatedDoctor.profile.fullName,
                specialty: updatedDoctor.specialty?.name || "",
                experience: updatedDoctor.experience || "",
                education: updatedDoctor.education || ""
            })
            const chunks = res.data?.chunks
            if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                await doctorRepository.createChunks(doctorId, chunks)
            }
        } catch (error) {
            console.error("Lỗi cập nhật Embedding Chunks cho Bác sĩ (Admin):", error.message)
        }

        return updatedDoctor
    }
}
