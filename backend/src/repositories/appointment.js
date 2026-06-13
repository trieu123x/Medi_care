import { prisma, Prisma } from "../configs/prisma-config.js"

/**
 * Chuyển chuỗi date "YYYY-MM-DD" thành khoảng [startOfDay, startOfNextDay] theo UTC+7.
 * Dùng để query Prisma thay cho exact DateTime, tránh lỗi timezone khi server chạy UTC.
 * @param {string|Date} date - "2026-05-29" hoặc Date object
 * @returns {{ gte: Date, lt: Date }}
 */
const toVNDateRange = (date) => {
    const str = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
    const [year, month, day] = str.slice(0, 10).split('-').map(Number);
    // UTC+7: nửa đêm Việt Nam = 17:00 UTC ngày hôm trước
    const gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000);
    const lt  = new Date(Date.UTC(year, month - 1, day, 24, 0, 0) - 7 * 60 * 60 * 1000);
    return { gte, lt };
};

export const appointmentRepository = {
    findAppointmentById: async (id) => {
        return await prisma.appointment.findUnique({
            where: { id },
            include: {
                patient: true,
                doctor: true,
            }
        })
    },

    create: async (data) => {
        const { patientId, doctorId, date, shift, reason } = data
        const appointmentDate = new Date(date)
        
        return await prisma.$transaction(async (tx) => {
            const existingPatientAppointment = await tx.appointment.findFirst({
                where: {
                    patientId: patientId,
                    date: toVNDateRange(date),
                    status: {
                        not:  'CANCELLED'
                    }
                }
            })

            if (existingPatientAppointment) {
                throw Object.assign(new Error("Bạn đã đặt một lịch khám trong ngày này rồi. Mỗi ngày chỉ được phép đặt tối đa 1 ca!"), { statusCode: 409 })
            }

            const doctorLeave = await tx.doctorLeave.findFirst({
                where: {
                    doctorId,
                    date: toVNDateRange(date),
                    OR: [
                        { shift: null }, 
                        { shift: shift } 
                    ]
                }
            })

            if (doctorLeave) {
                throw Object.assign(new Error("Bác sĩ đã báo bận/nghỉ ca khám này, vui lòng chọn ca khác!"), { statusCode: 409 })
            }

            const existingAppointment = await tx.appointment.findFirst({
                where: { 
                    doctorId,
                    date: toVNDateRange(date),
                    shift,
                    status: {
                        not:  'CANCELLED'
                    }
                }
            })

            if (existingAppointment) {
                throw Object.assign(new Error("Khung giờ này vừa có người đặt, vui lòng chọn ca khác!"), { statusCode: 409 })
            }

            try {
                return await tx.appointment.create({
                    data: {
                        patientId,
                        doctorId,
                        date: appointmentDate,
                        shift,
                        reason,
                        status: "PENDING"
                    },
                    select: { 
                        id: true, 
                        status: true,
                        date: true,
                        shift: true
                    }
                })
            } catch (error) {
                if (error.code === 'P2002') {
                    throw Object.assign(new Error("Không thể đặt trùng lịch."), { statusCode: 409 })
                }
                throw error;
            }
        })
    },

    updateMedicalRecord: async (appointmentId) => {
        return await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'COMPLETED' }
        })
    },

    getAllAppointments: async ({ date, status, lastId, limit = 30, desc = true }) => {
        const cursorCondition = lastId ? { id: lastId } : undefined
        const skip = lastId ? 1 : 0 
        const whereClause = {}

        if (date) {
            whereClause.date = toVNDateRange(date)
        }
        if (status) {
            whereClause.status = status
        }

        return await prisma.appointment.findMany({
            where: whereClause,
            take: limit,
            skip: skip,
            cursor: cursorCondition,
            orderBy: [
                { date: desc ? 'desc' : 'asc' }, 
                { shift: 'asc' }
            ],
            select: {
                id: true,
                status: true,
                reason: true,
                date: true,   
                shift: true, 
                patient: { select: { id: true } },
                doctor:  { select: { id: true } }
            }
        })
    },

    findById: async (id) => {
        return await prisma.appointment.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                reason: true,
                date: true,
                shift: true,
                patient: {
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        dob: true
                    }
                },
                doctor: {
                    select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                        doctor: {
                            select: {
                                specialty: { select: { name: true } }
                            }
                        }
                    }
                },
                medicalRecord: {
                    select: {
                        diagnosis: true,
                        prescription: true,
                        note: true,
                        createdAt: true
                    }
                }
            }
        })
    },

    findByPatientId: async ({ patientId, lastId, limit = 30, desc = true }) => {
        const cursorCondition = lastId ? { id: lastId } : undefined
        const skip = lastId ? 1 : 0 

        return await prisma.appointment.findMany({
            where: { patientId },
            take: limit,
            skip: skip,
            cursor: cursorCondition,
            orderBy: {
                createdAt: desc ? 'desc' : 'asc'
            },
            select: {
                id: true,
                status: true,
                reason: true,
                date: true,
                shift: true,
                medicalRecord: {
                    select: { diagnosis: true }
                },
                doctor: {
                    select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                        doctor: {
                            select: {
                                specialty: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        })
    },

    findByDoctorId: async ({ doctorId, date, lastId, limit = 30, desc = true }) => {
        const cursorCondition = lastId ? { id: lastId } : undefined
        const skip = lastId ? 1 : 0 
        const whereClause = { doctorId }

        if (date) {
            whereClause.date = toVNDateRange(date)
        }

        return await prisma.appointment.findMany({
            where: whereClause,
            take: limit,
            skip: skip,
            cursor: cursorCondition,
            orderBy: [
                { date: desc ? 'desc' : 'asc' }, 
                { shift: 'asc' }                
            ],
            select: {
                id: true,
                status: true,
                reason: true,
                date: true,
                shift: true,
                patient: { 
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        dob: true,
                        avatarUrl: true
                    }
                }
            }
        })
    },


    getUnavailableSlots: async ({ date, doctorId }) => {
        const dateRange = toVNDateRange(date)

        const whereBase = { date: dateRange }
        if (doctorId) whereBase.doctorId = doctorId

        const [appointments, leaves] = await Promise.all([
            prisma.appointment.findMany({
                where: whereBase,
                select: { shift: true, doctorId: true }
            }),
            prisma.doctorLeave.findMany({
                where: whereBase,
                select: { shift: true, doctorId: true }
            })
        ])
        console.log(leaves)
        return {
            bookedShifts: appointments,
            doctorLeaves: leaves
        }
    },

    updateStatus: async (id, status) => {
        if (status === "cancelled" || status === "canceled") {
            return await prisma.appointment.delete({
                where: { id },
                select: { 
                    id: true,
                    date: true,
                    shift: true
                }
            })
        }

        return await prisma.appointment.update({
            where: { id },
            data: { status },
            select: { 
                id: true, 
                status: true,
                date: true,
                shift: true 
            }
        })
    },
    
    createLeave: async (data) => {
        const { doctorId, date, shift, reason } = data;
        return await prisma.doctorLeave.create({
            data: {
                doctorId,
                date: new Date(date),
                shift: shift || null, 
                reason
            }
        });
    },

    findExistingLeave: async (doctorId, date, shift) => {
        return await prisma.doctorLeave.findFirst({
            where: {
                doctorId,
                date: toVNDateRange(date),
                shift: shift || null
            }
        });
    },

    findLeaveById: async (id) => {
        return await prisma.doctorLeave.findUnique({
            where: { id }
        });
    },

    findLeavesByDoctorId: async (doctorId) => {
        return await prisma.doctorLeave.findMany({
            where: { doctorId },
            select: {
                id: true,
                doctorId: true,
                date: true,
                shift: true,
                reason: true
            }
        });
    },

    deleteLeave: async (id) => {
        return await prisma.doctorLeave.delete({
            where: { id }
        });
    },

    /**
     * Kiểm tra bệnh nhân đã có lịch hẹn trong ngày chưa (timezone-safe).
     */
    findExistingPatientAppointment: async (patientId, date) => {
        return await prisma.appointment.findFirst({
            where: {
                patientId,
                date: toVNDateRange(date),
                status: { not: 'CANCELLED' }
            }
        });
    },

    /**
     * Lấy danh sách tất cả bác sĩ đang hoạt động.
     */
    findActiveDoctors: async () => {
        return await prisma.profile.findMany({
            where: { role: 'DOCTOR', isActive: true },
            select: { id: true }
        });
    }
}