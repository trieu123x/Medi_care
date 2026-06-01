import { medicineService } from "../services/medicine.js"
import { catchError } from "../helpers/catch-error.js"

export const getTotalMedicines = catchError(async (req, res) => {
    const total = await medicineService.getTotalCount()
    res.status(200).json({
        success: true,
        data: { total }
    })
})

export const getMedicinesForAdmin = catchError(async (req, res) => {
    const { name, typeId, lastId, limit } = req.query
    const data = await medicineService.getMedicinesForAdmin({
        name,
        typeId,
        lastId,
        limit: limit ? parseInt(limit) : 30
    })
    res.status(200).json({
        success: true,
        message: "Lấy danh sách thuốc cho admin thành công",
        data
    })
})

export const getAllMedicines = catchError(async (req, res) => {
    const { page = 1, limit = 10, ...filters } = req.query
    const data = await medicineService.getAllMedicines(filters, parseInt(page), parseInt(limit))
    res.status(200).json({
        success: true,
        message: "Lấy danh sách thuốc thành công",
        data
    })
})

export const getMedicineById = catchError(async (req, res) => {
    const { id } = req.params
    const userId = req.user?.id || null  // Lấy userId từ token nếu có
    const data = await medicineService.getMedicineById(id, userId)
    res.status(200).json({
        success: true,
        message: "Lấy thông tin thuốc thành công",
        data
    })
})

export const createMedicine = catchError(async (req, res) => {
    const data = await medicineService.createMedicine(req.body)
    res.status(201).json({
        success: true,
        message: "Thêm thuốc thành công",
        data
    })
})

export const updateMedicine = catchError(async (req, res) => {
    const { id } = req.params
    const data = await medicineService.updateMedicine(id, req.body)
    res.status(200).json({
        success: true,
        message: "Cập nhật thuốc thành công",
        data
    })
})

export const deleteMedicine = catchError(async (req, res) => {
    const { id } = req.params
    await medicineService.deleteMedicine(id)
    res.status(200).json({
        success: true,
        message: "Xóa thuốc thành công"
    })
})  