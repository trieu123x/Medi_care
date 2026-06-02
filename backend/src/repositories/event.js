import { prisma } from "../configs/prisma-config.js"

export const eventRepository = {
    track: async ({ userId, eventType, entityId = null, metadata = {} }) => {
        return await prisma.userEvent.create({
            data: {
                userId: userId || null,
                eventType,
                metadata: {
                    ...metadata,
                    ...(entityId ? { entityId } : {}),
                },
            },
            select: { id: true, eventType: true, createdAt: true }
        })
    },

    findByDate: async (dateStr) => {
        const start = new Date(`${dateStr}T00:00:00.000Z`)
        const end = new Date(`${dateStr}T23:59:59.999Z`)

        return await prisma.userEvent.findMany({
            where: {
                createdAt: { gte: start, lte: end }
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })
    },

    countByDate: async (dateStr) => {
        const start = new Date(`${dateStr}T00:00:00.000Z`)
        const end = new Date(`${dateStr}T23:59:59.999Z`)

        return await prisma.userEvent.count({
            where: {
                createdAt: { gte: start, lte: end }
            }
        })
    }
}
