import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { chatService } from '@/services/chat.js'
import { chatRepository } from '@/repositories/chat.js'
import { eventService } from '@/services/event.js'

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}))

vi.mock('@/repositories/chat.js', () => ({
  chatRepository: {
    createSession: vi.fn(),
    createMessage: vi.fn(),
    getSessionsByUserId: vi.fn(),
    getSessionById: vi.fn(),
    getMessagesBySessionId: vi.fn(),
    updateSessionTopic: vi.fn()
  }
}))

vi.mock('@/services/event.js', () => ({
  eventService: {
    track: vi.fn()
  }
}))

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('nên tạo session với title trả về từ AI và lưu user message', async () => {
      const mockSession = { id: 'session-1', userId: 'user-1', title: 'Tu van tim mach' }
      const mockMessage = { id: 'message-1', sessionId: 'session-1', role: 'USER', content: 'Toi bi dau nguc' }

      axios.post.mockResolvedValue({ data: { title: 'Tu van tim mach' } })
      chatRepository.createSession.mockResolvedValue(mockSession)
      chatRepository.createMessage.mockResolvedValue(mockMessage)

      const result = await chatService.createSession('user-1', 'Toi bi dau nguc')

      expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8000/ai/predict/title', {
        first_message: 'Toi bi dau nguc'
      })
      expect(chatRepository.createSession).toHaveBeenCalledWith('user-1', 'Tu van tim mach')
      expect(chatRepository.createMessage).toHaveBeenCalledWith('session-1', 'USER', 'Toi bi dau nguc')
      expect(result).toEqual({ session: mockSession, message: mockMessage })
    })

    it('nên fallback về title mặc định khi AI lỗi', async () => {
      axios.post.mockRejectedValue(new Error('AI unavailable'))
      chatRepository.createSession.mockResolvedValue({ id: 'session-2', title: 'New Chat' })
      chatRepository.createMessage.mockResolvedValue({ id: 'message-2' })

      await chatService.createSession('user-2', 'Xin chao')

      expect(chatRepository.createSession).toHaveBeenCalledWith('user-2', 'New Chat')
      expect(chatRepository.createMessage).toHaveBeenCalledWith('session-2', 'USER', 'Xin chao')
    })
  })

  describe('getSessions', () => {
    it('nên lấy danh sách sessions theo userId', async () => {
      const sessions = [{ id: 'session-1' }]
      chatRepository.getSessionsByUserId.mockResolvedValue(sessions)

      const result = await chatService.getSessions('user-1')

      expect(result).toEqual(sessions)
      expect(chatRepository.getSessionsByUserId).toHaveBeenCalledWith('user-1')
    })
  })

  describe('getSessionDetail', () => {
    it('nên trả về session và danh sách message khi user hợp lệ', async () => {
      const session = { id: 'session-1', userId: 'user-1' }
      const messages = [{ id: 'message-1', content: 'Hello' }]

      chatRepository.getSessionById.mockResolvedValue(session)
      chatRepository.getMessagesBySessionId.mockResolvedValue(messages)

      const result = await chatService.getSessionDetail('session-1', 'user-1', 'message-0', 20)

      expect(chatRepository.getMessagesBySessionId).toHaveBeenCalledWith('session-1', 'message-0', 20)
      expect(result).toEqual({ session, messages })
    })

    it('nên trả về mảng rỗng khi repository messages trả về null', async () => {
      const session = { id: 'session-1', userId: 'user-1' }
      chatRepository.getSessionById.mockResolvedValue(session)
      chatRepository.getMessagesBySessionId.mockResolvedValue(null)

      const result = await chatService.getSessionDetail('session-1', 'user-1')

      expect(result).toEqual({ session, messages: [] })
    })

    it('nên throw lỗi 404 nếu không tìm thấy session hoặc user không đúng', async () => {
      chatRepository.getSessionById.mockResolvedValue({ id: 'session-1', userId: 'user-x' })

      await expect(chatService.getSessionDetail('session-1', 'user-1')).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })

  describe('saveMessage', () => {
    it('nên lưu message với metadata nếu được truyền vào', async () => {
      const payload = { symptom: 'sot' }
      const message = { id: 'message-1', metadata: payload }
      chatRepository.getSessionById.mockResolvedValue({ id: 'session-1', userId: null })
      chatRepository.createMessage.mockResolvedValue(message)

      const result = await chatService.saveMessage('session-1', null, 'ASSISTANT', 'Ban co bi sot khong?', payload)

      expect(chatRepository.createMessage).toHaveBeenCalledWith('session-1', 'ASSISTANT', 'Ban co bi sot khong?', payload)
      expect(result).toEqual(message)
    })
  })

  describe('updateTopicTrigger', () => {
    it('nên cập nhật topic và track event khi có userId', async () => {
      axios.post.mockResolvedValue({ data: { data: { topic_name: 'Ho hap' } } })

      const result = await chatService.updateTopicTrigger('session-1', 'user-1')

      expect(axios.post).toHaveBeenCalledWith('http://127.0.0.1:8000/ai/predict/topic', {
        session_id: 'session-1'
      })
      expect(chatRepository.updateSessionTopic).toHaveBeenCalledWith('session-1', 'Ho hap')
      expect(eventService.track).toHaveBeenCalledWith('user-1', 'CHAT_AI_TOPIC', 'session-1', { topic: 'Ho hap' })
      expect(result).toBe('Ho hap')
    })

    it('nên dùng topic mặc định và track event nếu không có userId', async () => {
      axios.post.mockResolvedValue({ data: {} })

      const result = await chatService.updateTopicTrigger('session-2')

      expect(chatRepository.updateSessionTopic).toHaveBeenCalledWith('session-2', 'Nội tổng quát')
      expect(eventService.track).not.toHaveBeenCalled()
      expect(result).toBe('Nội tổng quát')
    })

    it('nên trả về null nếu gọi AI thất bại', async () => {
      axios.post.mockRejectedValue(new Error('timeout'))

      const result = await chatService.updateTopicTrigger('session-3', 'user-3')

      expect(chatRepository.updateSessionTopic).not.toHaveBeenCalled()
      expect(eventService.track).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })
})
