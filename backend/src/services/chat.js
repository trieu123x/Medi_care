import { chatRepository } from '../repositories/chat.js'
import { eventService } from './event.js'
import axios from 'axios'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'

export const chatService = {
    createSession: async (userId, content) => {
        // Create session with an initial title from the content to avoid blocking
        const initialTitle = content.trim().slice(0, 30) + (content.length > 30 ? '...' : '')
        const session = await chatRepository.createSession(userId, initialTitle)
        const message = await chatRepository.createMessage(session.id, 'USER', content)

        // Predict and update title in the background
        axios.post(`${AI_SERVICE_URL}/ai/predict/title`, {
            first_message: content
        }).then(async (aiResponse) => {
            if (aiResponse.data && aiResponse.data.title) {
                await chatRepository.updateSessionTitle(session.id, aiResponse.data.title)
            }
        }).catch((error) => {
            console.error("Lỗi khi gọi AI lấy title:", error.message)
        })

        return { session, message }
    },

    getSessions: async (userId) => {
        return await chatRepository.getSessionsByUserId(userId)
    },

    getSessionDetail: async (sessionId, userId, lastId = null, limit = 50) => {
        const session = await chatRepository.getSessionById(sessionId)
        if (!session || (userId && session.userId !== userId)) {
            throw Object.assign(new Error("Không tìm thấy phiên chat!"), { statusCode: 404 })
        }
        const messages = await chatRepository.getMessagesBySessionId(sessionId, lastId, limit)
        return { session, messages: messages || [] }
    },

    saveMessage: async (sessionId, userId, role, content, metadata = null) => {
        const session = await chatRepository.getSessionById(sessionId)
        if (!session || (userId && session.userId !== userId)) {
            throw Object.assign(new Error("Không tìm thấy phiên chat hoặc bạn không có quyền!"), { statusCode: 404 })
        }
        return await chatRepository.createMessage(sessionId, role, content, metadata)
    },

    updateTopicTrigger: async (sessionId, userId) => {
        try {
            const aiResponse = await axios.post(`${AI_SERVICE_URL}/ai/predict/topic`, {
                session_id: sessionId
            })

            const topic = aiResponse.data?.data?.topic_name || "Nội tổng quát"

            await chatRepository.updateSessionTopic(sessionId, topic)

            if (userId) {
                eventService.track(userId, 'CHAT_AI_TOPIC', sessionId, { topic })
            }

            return topic
        } catch (error) {
            console.error("Lỗi khi cập nhật topic từ AI:", error.message)
            return null
        }
    },

    deleteSession: async (sessionId, userId) => {
        const session = await chatRepository.getSessionById(sessionId)
        if (!session || (userId && session.userId !== userId)) {
            throw Object.assign(new Error("Không tìm thấy phiên chat!"), { statusCode: 404 })
        }
        return await chatRepository.deleteSession(sessionId)
    }
}
