import { doctorService } from "../services/doctor.js"

export const doctorController = {
    getAllDoctors: async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 10
            const { name, specialtyId } = req.query
            
            const result = await doctorService.getAllDoctors(page, limit, { name, specialtyId })
            
            res.status(200).json({
                success: true,
                data: result.doctors,
                pagination: result.pagination
            })
        } catch (error) {
            next(error)
        }
    },

    getDoctorById: async (req, res, next) => {
        try {
            const { id } = req.params
            const userId = req.user?.id || null  // Lấy userId từ token nếu có
            const doctor = await doctorService.getDoctorById(id, userId)
            
            res.status(200).json({
                success: true,
                data: doctor
            })
        } catch (error) {
            next(error)
        }
    },

    updateDoctorInfo: async (req, res, next) => {
        try {
            const { id } = req.params
            const requesterId = req.user.id
            const updateData = req.body
            
            const updatedDoctor = await doctorService.updateDoctorInfo(id, requesterId, updateData)
            
            res.status(200).json({
                success: true,
                message: "Cập nhật thông tin bác sĩ thành công",
                data: updatedDoctor
            })
        } catch (error) {
            next(error)
        }
    },

    createDoctor: async (req, res, next) => {
        try {
            const doctorData = req.body
            const newDoctor = await doctorService.createDoctor(doctorData)
            res.status(201).json({
                success: true,
                message: "Tạo tài khoản bác sĩ thành công",
                data: newDoctor
            })
        } catch (error) {
            next(error)
        }
    },

    updateDoctorByAdmin: async (req, res, next) => {
        try {
            const { id } = req.params
            const updateData = req.body
            
            const updatedDoctor = await doctorService.updateDoctorByAdmin(id, updateData)
            
            res.status(200).json({
                success: true,
                message: "Cập nhật thông tin bác sĩ (bởi Admin) thành công",
                data: updatedDoctor
            })
        } catch (error) {
            next(error)
        }
    }
}
