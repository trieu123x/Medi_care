import { uploadHelper } from "../helpers/storage-helper.js"
import { diseaseRepository } from "../repositories/disease.js"
import { eventService } from "./event.js"
import axios from "axios"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'

export const diseaseService = {
    getTotalCount: async () => {
        return await diseaseRepository.countAll()
    },

    createDisease: async (data, file) => {
        if (file) {
            const imageUrl = await uploadHelper.uploadFile(file, 'medicare', 'diseases')
            data.imageUrl = imageUrl
        }

        const newDisease = await diseaseRepository.create(data)
        try {
            if (data.symptoms) {
                const res = await axios.post(`${AI_SERVICE_URL}/ai/disease`, {
                    content: data.symptoms
                })

                const chunks = res.data?.chunks
                if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                    await diseaseRepository.createChunks(newDisease.id, chunks)
                    // Vẫn cập nhật vector tổng cho disease nếu cần (lấy chunk đầu tiên làm đại diện)
                    await diseaseRepository.updateEmbedding(newDisease.id, chunks[0].vector)
                }
            }
        } catch (error) {
            console.error("Lỗi tạo Embedding Vector:", error.message)
        }

        return newDisease
    },

    updateDisease: async (id, data, file) => {
        if (file) {
            const existingDisease = await diseaseRepository.findById(id)

            if (existingDisease?.imageUrl) {
                await uploadHelper.deleteFile(existingDisease.imageUrl, 'medicare')
            }

            const newImageUrl = await uploadHelper.uploadFile(file, 'medicare', 'diseases')
            data.imageUrl = newImageUrl
        }

        const updatedDisease = await diseaseRepository.update(id, data)

        if (data.symptoms) {
            try {
                const res = await axios.post(`${AI_SERVICE_URL}/ai/disease`, {
                    content: data.symptoms
                })

                const chunks = res.data?.chunks
                if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                    await diseaseRepository.createChunks(id, chunks)
                    // Vẫn cập nhật vector tổng cho disease nếu cần
                    await diseaseRepository.updateEmbedding(id, chunks[0].vector)
                }
            } catch (error) {
                console.error("Lỗi Cập nhật Embedding Vector:", error.message)
            }
        }

        return updatedDisease
    },

    getDiseases: async (filters) => {
        const result = await diseaseRepository.findWithFilter(filters)

        return {
            items: result.items,
            pagination: {
                total: result.total,
                page: filters.page || 1,
                limit: filters.limit || 12,
                totalPages: Math.ceil(result.total / (filters.limit || 12))
            }
        }
    },

    getDiseasesForAdmin: async (filters) => {
        const { items, total } = await diseaseRepository.findAllForAdmin(filters)
        const limit = filters.limit || 30
        const page = filters.page || 1
        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    },

    getDiseaseDetail: async (id, userId = null) => {
        const disease = await diseaseRepository.findById(id)
        if (!disease) {
            throw Object.assign(new Error("Không tìm thấy thông tin bệnh!"), { statusCode: 404 })
        }

        eventService.track(userId, 'VIEW_DISEASE', id, {
            diseaseName: disease.name,
        })

        return disease
    },

    diagnoseBySymptoms: async (userSymptoms) => {
        if (!userSymptoms) {
            throw new Error("Vui lòng nhập triệu chứng!")
        }

        // Biến mô tả của người dùng thành Vector
        const inputVector = []

        return await diseaseRepository.findSimilarDiseases(inputVector, 5)
    },

    deleteDisease: async (id) => {
        const existing = await diseaseRepository.findById(id)
        if (existing?.imageUrl) {
            await uploadHelper.deleteFile(existing.imageUrl, 'medicare')
        }

        return await diseaseRepository.delete(id)
    }
}