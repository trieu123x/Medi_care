import { diseaseService } from "../services/disease.js"
import { catchError } from "../helpers/catch-error.js"

export const getTotalDiseases = catchError(async (req, res) => {
    const total = await diseaseService.getTotalCount()
    res.status(200).json({
        success: true,
        data: { total }
    })
})

export const createDisease = catchError(async (req, res) => {
    const diseaseData = req.body
    const file = req.file 

    const data = await diseaseService.createDisease(diseaseData, file)
    res.status(201).json({
        success: true,
        message: "Thêm bệnh mới thành công",
        data
    })
})

export const getDiseases = catchError(async (req, res) => { 
    const { categoryId, specialtyId, name, page, limit } = req.query
    
    const data = await diseaseService.getDiseases({ 
        categoryId, 
        specialtyId, 
        name, 
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 12 
    })

    res.status(200).json({
        success: true,
        message: "Lấy danh sách bệnh thành công",
        data
    })
})

export const getDiseasesForAdmin = catchError(async (req, res) => { 
    const { categoryId, specialtyId, name, lastId, limit } = req.query
    
    const data = await diseaseService.getDiseasesForAdmin({ 
        categoryId, 
        specialtyId, 
        name, 
        lastId,
        limit: limit ? parseInt(limit) : 30 
    })

    res.status(200).json({
        success: true,
        message: "Lấy danh sách bệnh cho admin thành công",
        data
    })
})

export const getDiseaseById = catchError(async (req, res) => {
    const { diseaseId } = req.params
    const data = await diseaseService.getDiseaseDetail(diseaseId, req.user?.id)
    res.status(200).json({
        success: true,
        message: "Lấy chi tiết bệnh thành công",
        data
    })
})

export const updateDisease = catchError(async (req, res) => {
    const { diseaseId } = req.params
    const updateData = req.body
    const file = req.file 

    const data = await diseaseService.updateDisease(diseaseId, updateData, file)
    res.status(200).json({
        success: true,
        message: "Cập nhật thông tin bệnh thành công",
        data
    })
})

export const deleteDisease = catchError(async (req, res) => {
    const { diseaseId } = req.params

    await diseaseService.deleteDisease(diseaseId)
    res.status(200).json({
        success: true,
        message: "Xóa bệnh thành công"
    })
})

export const diagnoseSymptoms = catchError(async (req, res) => {
    const { symptoms } = req.body

    const data = await diseaseService.diagnoseBySymptoms(symptoms)
    res.status(200).json({
        success: true,
        message: "Phân tích triệu chứng thành công",
        data
    })
})