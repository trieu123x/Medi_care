import { prisma } from "../configs/prisma-config.js"

export const reportRepository = {
    getReportsByTimeRange: async ({ reportName, mode, startDate, endDate }) => {
        return await prisma.etlReports.findMany({
            where: {
                reportName,
                mode,
                startDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            orderBy: { startDate: 'asc' }
        });
    },

    getReportById: async (id) => {
        return await prisma.etlReports.findUnique({
            where: { id }
        });
    },

    /**
     * Query trực tiếp từ user_events — real-time
     */
    getLiveStats: async ({ startDate, endDate }) => {
        const start = new Date(`${startDate}T00:00:00.000Z`)
        const end   = new Date(`${endDate}T23:59:59.999Z`)

        const where = { createdAt: { gte: start, lte: end } }

        // 1. Tổng sự kiện
        const totalEvents = await prisma.userEvent.count({ where })

        // 2. Tổng truy cập (VIEW_DOCTOR + VIEW_DISEASE)
        const totalVisits = await prisma.userEvent.count({
            where: {
                ...where,
                eventType: { in: ['VIEW_DOCTOR', 'VIEW_DISEASE'] }
            }
        })

        // 3. Tổng phiên chat
        const totalChats = await prisma.chatSession.count({
            where: { startedAt: { gte: start, lte: end } }
        })

        // 4. Top bác sĩ: gom theo doctorId trong metadata
        const viewDoctorEvents = await prisma.userEvent.findMany({
            where: { ...where, eventType: 'VIEW_DOCTOR' },
            select: { metadata: true }
        })
        const bookEvents = await prisma.userEvent.findMany({
            where: { ...where, eventType: 'BOOK_APPOINTMENT' },
            select: { metadata: true }
        })

        // Gom view_count và booking_count theo doctorId
        const doctorMap = {}
        for (const e of viewDoctorEvents) {
            const id = e.metadata?.entityId
            if (!id) continue
            if (!doctorMap[id]) doctorMap[id] = { view_count: 0, booking_count: 0 }
            doctorMap[id].view_count++
        }
        for (const e of bookEvents) {
            const id = e.metadata?.doctorId
            if (!id) continue
            if (!doctorMap[id]) doctorMap[id] = { view_count: 0, booking_count: 0 }
            doctorMap[id].booking_count++
        }

        // Lấy tên bác sĩ từ DB
        const doctorIds = Object.keys(doctorMap)
        const doctorProfiles = doctorIds.length > 0
            ? await prisma.profile.findMany({
                where: { id: { in: doctorIds } },
                select: {
                    id: true,
                    fullName: true,
                    doctor: { select: { specialty: { select: { name: true } } } }
                }
              })
            : []

        const topDoctors = doctorProfiles
            .map(p => ({
                doctor_name: p.fullName,
                specialty_name: p.doctor?.specialty?.name || '',
                view_count: doctorMap[p.id].view_count,
                booking_count: doctorMap[p.id].booking_count,
                popularity_score: doctorMap[p.id].view_count * 1 + doctorMap[p.id].booking_count * 3
            }))
            .sort((a, b) => b.popularity_score - a.popularity_score)
            .slice(0, 10)

        // 5. Top bệnh: VIEW_DISEASE
        const viewDiseaseEvents = await prisma.userEvent.findMany({
            where: { ...where, eventType: 'VIEW_DISEASE' },
            select: { metadata: true }
        })
        const diseaseMap = {}
        for (const e of viewDiseaseEvents) {
            const id = e.metadata?.entityId
            if (!id) continue
            diseaseMap[id] = (diseaseMap[id] || 0) + 1
        }
        const diseaseIds = Object.keys(diseaseMap)
        const diseaseRecords = diseaseIds.length > 0
            ? await prisma.disease.findMany({
                where: { id: { in: diseaseIds } },
                select: {
                    id: true,
                    name: true,
                    specialty: { select: { name: true } }
                }
              })
            : []

        const topDiseases = diseaseRecords
            .map(d => ({
                disease_name: d.name,
                specialty_name: d.specialty?.name || '',
                total_views: diseaseMap[d.id],
                interest_score: diseaseMap[d.id]
            }))
            .sort((a, b) => b.total_views - a.total_views)
            .slice(0, 10)

        // 6. Ca khám cao điểm: BOOK_APPOINTMENT — đếm theo shift
        const peakMap = {}
        for (const e of bookEvents) {
            const shift = e.metadata?.shift
            if (!shift) continue
            const label = `Ca ${shift}`
            peakMap[label] = (peakMap[label] || 0) + 1
        }
        const peakShifts = Object.entries(peakMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => parseInt(a.label.split(' ')[1]) - parseInt(b.label.split(' ')[1]))

        // 7. Top chủ đề chat — từ user_events CHAT_AI_TOPIC (metadata.topic)
        const chatTopicEvents = await prisma.userEvent.findMany({
            where: { ...where, eventType: 'CHAT_AI_TOPIC' },
            select: { metadata: true }
        })
        const chatTopicMap = {}
        for (const e of chatTopicEvents) {
            const topic = e.metadata?.topic || 'Khác'
            chatTopicMap[topic] = (chatTopicMap[topic] || 0) + 1
        }
        const chatTopics = Object.entries(chatTopicMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)

        return {
            kpis: { events: totalEvents, visits: totalVisits, chats: totalChats },
            topDoctors,
            topDiseases,
            peakShifts,
            chatTopics
        }
    }
}