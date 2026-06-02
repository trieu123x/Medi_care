import { medicineRepository } from "../repositories/medicine.js"
import { eventService } from "./event.js"
import axios from "axios"

export const medicineService = {
    getTotalCount: async () => {
        return await medicineRepository.countAll()
    },

    getMedicinesForAdmin: async (filters) => {
        return await medicineRepository.findAllForAdmin(filters)
    },

    getAllMedicines: async (filters = {}, page = 1, limit = 10) => {
        const skip = (page - 1) * limit
        const { medicines, total } = await medicineRepository.findAll(filters, skip, limit)
        return {
            medicines,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit)
            }
        }
    },

    getMedicineById: async (id, userId = null) => {
        const medicine = await medicineRepository.findById(id)
        if (!medicine) {
            throw Object.assign(new Error("Không tìm thấy thuốc"), { statusCode: 404 })
        }
        
        eventService.track(userId, 'VIEW_MEDICINE', id, {
            medicineName: medicine.name,
        })
        
        return medicine
    },

    createMedicine: async (data) => {
        const newMedicine = await medicineRepository.create(data)
        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
            const res = await axios.post(`${AI_SERVICE_URL}/ai/disease/medicine`, {
                name: data.name,
                ingredients: data.ingredients || "",
                usage: data.usageInstruction || "",
                side_effects: data.sideEffects || ""
            })
            const chunks = res.data?.chunks
            if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                await medicineRepository.createChunks(newMedicine.id, chunks)
            }
        } catch (error) {
            console.error("Lỗi tạo Embedding Chunks cho Thuốc:", error.message)
        }
        return newMedicine
    },

    updateMedicine: async (id, data) => {
        const updatedMedicine = await medicineRepository.update(id, data)
        try {
            const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
            const res = await axios.post(`${AI_SERVICE_URL}/ai/disease/medicine`, {
                name: updatedMedicine.name,
                ingredients: updatedMedicine.ingredients || "",
                usage: updatedMedicine.usageInstruction || "",
                side_effects: updatedMedicine.sideEffects || ""
            })
            const chunks = res.data?.chunks
            if (chunks && Array.isArray(chunks) && chunks.length > 0) {
                await medicineRepository.createChunks(id, chunks)
            }
        } catch (error) {
            console.error("Lỗi Cập nhật Embedding Chunks cho Thuốc:", error.message)
        }
        return updatedMedicine
    },

    deleteMedicine: async (id) => {
        await medicineRepository.delete(id)
    }
}