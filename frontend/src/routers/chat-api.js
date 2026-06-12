import axiosInstance from '@/utils/axios'

export const createChatSession = async (data) => {
  console.log("STEP 2!")
  return await axiosInstance.post('/chat', data, { timeout: 30000 })
}

export const getChatSessions = async (params = {}) => {
  return await axiosInstance.get('/chat', { params })
}

export const getSessionHistory = async (sessionId, params = {}) => {
  return await axiosInstance.get(`/chat/${sessionId}/messages`, { params })
}

export const saveChatMessage = async (sessionId, messageData) => {
  return await axiosInstance.post(`/chat/${sessionId}/messages`, messageData)
}

export const deleteChatSession = async (sessionId) => {
  return await axiosInstance.delete(`/chat/${sessionId}`)
}

export const aiChatApi = async (
  sessionId,
  userInput,
  onChunkReceived = (chunk) => { },
  onDone = () => { },
  onError = (err) => { }
) => {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL
    console.log("SESSION ID: ", sessionId)
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_input: userInput,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Body không được hỗ trợ!')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        onDone()
        break
      }

      const chunkText = decoder.decode(value, { stream: true })
      if (chunkText) {
        onChunkReceived(chunkText)
      }
    }
  } catch (error) {
    console.error('Lỗi khi chat AI:', error)
    onError(error)
  }
}