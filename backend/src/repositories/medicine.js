import { prisma } from "../configs/prisma-config.js"

export const medicineRepository = {
    countAll: async () => {
        return await prisma.medicine.count()
    },

    findAllForAdmin: async ({ name, typeId, page = 1, limit = 30 }) => {
        const where = {}
        if (name) where.name = { contains: name, mode: 'insensitive' }
        if (typeId) where.typeId = typeId

        const skip = (page - 1) * limit

        const [medicines, total] = await Promise.all([
            prisma.medicine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { id: 'asc' },
                include: { medicineType: true }
            }),
            prisma.medicine.count({ where })
        ])

        return { items: medicines, total }
    },

    findAll: async (filters = {}, skip = 0, limit = 10) => {
        const where = {}

        if (filters.name) {
            where.name = { contains: filters.name, mode: 'insensitive' }
        }
        if (filters.typeId) {
            where.typeId = filters.typeId
        }

        const [medicines, total] = await Promise.all([
            prisma.medicine.findMany({
                where,
                skip,
                take: limit
            }),
            prisma.medicine.count({ where })
        ])

        return { medicines, total }
    },

    findById: async (id) => {
        return await prisma.medicine.findUnique({
            where: { id },
            include: {
                medicineType: true,
                diseases: {
                    include: {
                        disease: {
                            include: {
                                specialty: true,
                                category: true
                            }
                        }
                    }
                }
            }
        })
    },

    create: async (data) => {
        return await prisma.medicine.create({
            data,
            include: { medicineType: true }
        })
    },

    update: async (id, data) => {
        return await prisma.medicine.update({
            where: { id },
            data,
            include: { medicineType: true }
        })
    },

    delete: async (id) => {
        await prisma.medicineChunk.deleteMany({
            where: { medicineId: id }
        })
        return await prisma.medicine.delete({
            where: { id }
        })
    },

    createChunks: async (medicineId, chunks) => {
        await prisma.$executeRaw`DELETE FROM medicine_chunks WHERE medicine_id = ${medicineId}::uuid`
        for (const chunk of chunks) {
            const vectorString = `[${chunk.vector.join(',')}]`
            await prisma.$executeRaw`
                INSERT INTO medicine_chunks (id, medicine_id, content, embedding)
                VALUES (gen_random_uuid(), ${medicineId}::uuid, ${chunk.content}, ${vectorString}::vector)
            `
        }
    }
}
