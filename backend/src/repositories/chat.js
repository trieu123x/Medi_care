import { prisma } from "../configs/prisma-config.js"

export const chatRepository = {
    createSession: async (userId, title = 'New Chat') => {
        return await prisma.chatSession.create({
            data: {
                userId,
                title,
                isActive: true
            }
        })
    },

    getSessionById: async (id) => {
        return await prisma.chatSession.findUnique({
            where: { id }
        })
    },

    getSessionsByUserId: async (userId) => {
        return await prisma.chatSession.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            select: {
                id: true,
                title: true,
                startedAt: true,
                endedAt: true
            }
        })
    },

    updateSessionTopic: async (id, topic) => {
        return await prisma.chatSession.update({
            where: { id },
            data: { topic }
        })
    },

    updateSessionTitle: async (id, title) => {
        return await prisma.chatSession.update({
            where: { id },
            data: { title }
        })
    },

    createMessage: async (sessionId, role, content, metadata = null) => {
        return await prisma.chatMessage.create({
            data: {
                sessionId,
                role,
                content,
                metadata: metadata ? metadata : undefined
            }
        })
    },

    getMessagesBySessionId: async (sessionId, lastId = null, limit = 50) => {
        const query = {
            where: { sessionId },
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }

        if (lastId) {
            query.cursor = { id: lastId }
            query.skip = 1
        }

        const messages = await prisma.chatMessage.findMany(query)
        return messages
    },

    deleteSession: async (id) => {
        return await prisma.chatSession.delete({
            where: { id }
        })
    }
}
