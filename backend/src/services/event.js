import { eventRepository } from "../repositories/event.js"

// Dedup cache: tránh insert event trùng trong vòng 5 giây
const _dedupCache = new Map()
const DEDUP_TTL_MS = 5000

function _isDuplicate(key) {
    const now = Date.now()
    const last = _dedupCache.get(key)
    if (last && now - last < DEDUP_TTL_MS) return true
    _dedupCache.set(key, now)
    // Dọn cache cũ để tránh memory leak
    if (_dedupCache.size > 500) {
        const cutoff = now - DEDUP_TTL_MS
        for (const [k, t] of _dedupCache) {
            if (t < cutoff) _dedupCache.delete(k)
        }
    }
    return false
}

export const eventService = {
    // Gọi hàm này ở service layer, không cần await
    track(userId, eventType, entityId = null, metadata = {}) {
        const dedupKey = `${userId || 'anon'}:${eventType}:${entityId || ''}`
        if (_isDuplicate(dedupKey)) return

        eventRepository.track({ userId, eventType, entityId, metadata })
            .catch(err => console.error('[EventTracker]', err.message))
    },

    // Dùng cho API test từ Postman — cần await
    createEvent: async (data) => {
        return await eventRepository.track(data)
    },

    getEvents: async (dateStr) => {
        const events = await eventRepository.findByDate(dateStr)
        const count = await eventRepository.countByDate(dateStr)
        return { count, events }
    }
}
