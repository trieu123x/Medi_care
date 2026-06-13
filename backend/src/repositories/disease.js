import { prisma, Prisma } from "../configs/prisma-config.js"

export const diseaseRepository = {
    countAll: async () => {
        return await prisma.disease.count()
    },

    create: async (data) => {
        const { name, categoryId, specialtyId, symptoms, description, imageUrl, homeTreatment } = data
        
        return await prisma.disease.create({
            data: {
                name,
                categoryId,  
                specialtyId,
                symptoms,
                description,
                imageUrl,
                homeTreatment
            },
            select: { id: true, name: true }
        })
    }, 

    update: async (id, data) => {
        return await prisma.disease.update({
            where: { id },
            data: {
                ...data
            },
            select: { id: true, name: true }
        })
    },

    updateEmbedding: async (id, vector) => { // Đầu vào của vector nhớ là phải để list
        const vectorString = `[${vector.join(',')}]`
        
        return await prisma.$executeRaw`
            UPDATE diseases
            SET embedding = ${vectorString}::vector
            WHERE id = ${id}::uuid
        `
    },

    createChunks: async (diseaseId, chunks) => {
        // Xóa các chunk cũ nếu có (trong trường hợp update)
        await prisma.$executeRaw`DELETE FROM disease_chunks WHERE disease_id = ${diseaseId}::uuid`
        
        // Thêm các chunk mới
        for (const chunk of chunks) {
            const vectorString = `[${chunk.vector.join(',')}]`
            await prisma.$executeRaw`
                INSERT INTO disease_chunks (id, disease_id, content, embedding)
                VALUES (gen_random_uuid(), ${diseaseId}::uuid, ${chunk.content}, ${vectorString}::vector)
            `
        }
    },

    findWithFilter: async ({ categoryId, specialtyId, name, page = 1, limit = 30 }) => {
        const searchPattern = name ? `%${name.toLowerCase()}%` : null
        const nameLower = name ? name.toLowerCase() : null
        const offset = (page - 1) * limit

        const filterConditions = Prisma.sql`
            1=1
            ${categoryId ? Prisma.sql`AND category_id = ${categoryId}::uuid` : Prisma.empty}
            ${specialtyId ? Prisma.sql`AND specialty_id = ${specialtyId}::uuid` : Prisma.empty}
            ${name ? Prisma.sql`
                AND (
                    name_clean LIKE ${searchPattern} 
                    OR name_clean % ${nameLower}
                )` : Prisma.empty}
        `

        // Query total count
        const totalCountParams = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM diseases
            WHERE ${filterConditions}
        `
        const total = totalCountParams[0]?.count || 0

        const diseases = await prisma.$queryRaw`
            SELECT 
                id, 
                name, 
                image_url AS "imageUrl", 
                description
            FROM diseases
            WHERE ${filterConditions}
            ORDER BY 
                ${name ? Prisma.sql`similarity(name_clean, ${nameLower}) DESC,` : Prisma.empty} 
                id ASC
            LIMIT ${limit}
            OFFSET ${offset}
        `

        return {
            items: diseases.map(disease => ({
                id: disease.id,
                name: disease.name,
                imageUrl: disease.imageUrl,
                description: disease.description
            })),
            total
        }
    },

    findAllForAdmin: async ({ categoryId, specialtyId, name, page = 1, limit = 30 }) => {
        const searchPattern = name ? `%${name.toLowerCase()}%` : null
        const nameLower = name ? name.toLowerCase() : null
        const offset = (page - 1) * limit

        const filterConditions = Prisma.sql`
            1=1
            ${categoryId ? Prisma.sql`AND d.category_id = ${categoryId}::uuid` : Prisma.empty}
            ${specialtyId ? Prisma.sql`AND d.specialty_id = ${specialtyId}::uuid` : Prisma.empty}
            ${name ? Prisma.sql`
                AND (
                    d.name_clean LIKE ${searchPattern} 
                    OR d.name_clean % ${nameLower}
                )` : Prisma.empty}
        `

        const totalResult = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM diseases d
            WHERE ${filterConditions}
        `
        const total = totalResult[0]?.count || 0

        const diseases = await prisma.$queryRaw`
            SELECT 
                d.id, 
                d.name, 
                d.image_url AS "imageUrl", 
                d.description,
                d.symptoms,
                d.home_treatment AS "homeTreatment",
                s.name AS "specialtyName",
                dc.name AS "categoryName"
            FROM diseases d
            LEFT JOIN specialties s ON d.specialty_id = s.id
            LEFT JOIN disease_categories dc ON d.category_id = dc.id
            WHERE ${filterConditions}
            ORDER BY 
                ${name ? Prisma.sql`similarity(d.name_clean, ${nameLower}) DESC,` : Prisma.empty} 
                d.id ASC
            LIMIT ${limit}
            OFFSET ${offset}
        `

        return {
            items: diseases.map(disease => ({
                id: disease.id,
                name: disease.name,
                imageUrl: disease.imageUrl,
                description: disease.description,
                symptoms: disease.symptoms,
                homeTreatment: disease.homeTreatment,
                specialtyName: disease.specialtyName,
                categoryName: disease.categoryName
            })),
            total
        }
    },

    findById: async (id) => {
        const disease = await prisma.disease.findUnique({
            where: { id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                specialty: {
                    include: {
                        doctors: {
                            include: {
                                profile: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        avatarUrl: true,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    }
                },
                medicines: {
                    include: {
                        medicine: true
                    }
                }
            }
        })
        
        return disease
    },

    findSimilarDiseases: async (inputVector, limit = 5) => { // Đầu vào của vector nhớ là phải để list
        const vectorString = `[${inputVector.join(',')}]`

        return await prisma.$queryRaw`
            SELECT 
                id, 
                name, 
                symptoms, 
                description,
                image_url AS "imageUrl",
                (1 - (embedding <=> ${vectorString}::vector)) AS "similarityScore"
            FROM diseases
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${vectorString}::vector
            LIMIT ${limit}
        `
    },

    delete: async (id) => {
        return await prisma.disease.delete({
            where: { id },
            select: { id: true, name: true }
        })
    }
} 