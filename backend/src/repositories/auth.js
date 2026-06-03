import { prisma } from "../configs/prisma-config.js"

export const profileRepository = {
    findById: async (id) => {
        return await prisma.profile.findUnique({
            where: { id },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                role: true,
                dob: true,
                address: true,
                createdAt: true,
                isActive: true,
                avatarCropData: true
            }
        })
    },

    create: async ({ id, fullName, email, phone, role = "PATIENT" }) => {
        return await prisma.profile.create({
            data: { id, fullName, email, phone, role }
        })
    },

    findByPhone: async (phone) => {
        return await prisma.profile.findFirst({
            where: { phone }
        })
    },

    findByEmail: async (email) => {
        return await prisma.profile.findFirst({
            where: { email }
        })
    }
}
