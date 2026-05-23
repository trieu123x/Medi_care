import { appointmentRepository } from "../repositories/appointment.js"

/**
 * Chuyển "YYYY-MM-DD" thành đối tượng Date ở đầu ngày theo giờ Việt Nam (UTC+7).
 * Tránh lỗi timezone khi server deploy chạy UTC.
 */
const toVNMidnight = (dateStr) => {
    const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0, 10);
    const [year, month, day] = str.slice(0, 10).split('-').map(Number);
    // 00:00:00 giờ Việt Nam = UTC-7h = ngày hôm đó 17:00 UTC
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000);
};

/**
 * Trả về đầu ngày hôm nay theo giờ Việt Nam.
 */
const todayVN = () => {
    const now = new Date();
    // Chuyển sang gờ Việt Nam rồi lấy ngày
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const year = vnNow.getUTCFullYear();
    const month = vnNow.getUTCMonth();
    const day = vnNow.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0) - 7 * 60 * 60 * 1000);
};

const ALL_SHIFTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const appointmentService = {
    getAllAppointments: async (filters) => {
        const appointments = await appointmentRepository.getAllAppointments(filters)

        return appointments.map(app => ({
            appointmentId: app.id,
            date: app.date,
            shift: app.shift,
            status: app.status,
            reason: app.reason,
            patient: app.patient ? {
                patientId: app.patient.id,
                name: app.patient.fullName,
                phone: app.patient.phone
            } : null,
            doctor: app.doctor ? {
                doctorId: app.doctor.id,
                name: app.doctor.fullName,
                specialityName: app.doctor.doctor?.specialty?.name
            } : null
        }))
    },

    getAppointmentDetail: async (id) => {
        const appointment = await appointmentRepository.findById(id)
        if (!appointment) {
            throw Object.assign(new Error("Không tìm thấy lịch khám hoặc lịch đã bị hủy!"), { statusCode: 404 })
        }

        return {
            appointmentId: appointment.id,
            patient: appointment.patient ? {
                userId: appointment.patient.id,
                name: appointment.patient.fullName,
                phone: appointment.patient.phone,
                dob: appointment.patient.dob
            } : null,
            doctor: appointment.doctor ? {
                doctorId: appointment.doctor.id, 
                name: appointment.doctor.fullName,
                specialityName: appointment.doctor.doctor?.specialty?.name
            } : null,
            schedule: {
                date: appointment.date,
                shift: appointment.shift,
                status: appointment.status
            },
            note: appointment.reason,
            medicalRecord: appointment.medicalRecord || null
        }
    },

    getPatientHistory: async (filters) => {
        const appointments = await appointmentRepository.findByPatientId(filters)

        return appointments.map(app => ({
            appointmentId: app.id,
            date: app.date,
            shift: app.shift,
            status: app.status,
            doctor: app.doctor ? {
                doctorId: app.doctor.id,
                name: app.doctor.fullName,
                specialityName: app.doctor.doctor?.specialty?.name,
                avatarUrl: app.doctor.avatarUrl
            } : null,
            symptoms: app.reason,
            diagnosis: app.medicalRecord?.diagnosis || null
        }))
    },

    getDoctorSchedule: async (filters) => {
        const appointments = await appointmentRepository.findByDoctorId(filters)

        return appointments.map(app => ({
            appointmentId: app.id,
            date: app.date,
            shift: app.shift,
            status: app.status,
            reason: app.reason, 
            patient: app.patient ? {
                patientId: app.patient.id,
                name: app.patient.fullName,
                phone: app.patient.phone,
                dob: app.patient.dob,
                avatarUrl: app.patient.avatarUrl
            } : null
        }))
    },

    getDoctorLeaves: async (doctorId) => {
        const leaves = await appointmentRepository.findLeavesByDoctorId(doctorId);
        
        return leaves.map(leave => ({
            id: leave.id,
            doctorId: leave.doctorId,
            date: leave.date,
            shift: leave.shift,
            reason: leave.reason
        }));
    },

    getAvailableSlots: async (filters) => {
        const { date, doctorId, patientId } = filters
        console.log("Patient ID nhận được:", patientId)

        if (!date) {
            throw Object.assign(new Error("Vui lòng cung cấp ngày cần xem lịch!"), { statusCode: 400 })
        }

        const targetDate = toVNMidnight(date)
        const today = todayVN()

        if (targetDate < today) {
            return []
        }

        
        if (patientId) {
            const patientExistingAppointment = await appointmentRepository.findExistingPatientAppointment(patientId, date);

            if (patientExistingAppointment) {
                return []; 
            }
        }

        let targetDoctors = []
        if (doctorId) {
            targetDoctors = [{ id: doctorId }]
        } else {
            targetDoctors = await appointmentRepository.findActiveDoctors()
        }

        if (targetDoctors.length === 0) return []

        const unavailable = await appointmentRepository.getUnavailableSlots({ date, doctorId })

        const doctorBusyMap = {}
        targetDoctors.forEach(doc => {
            doctorBusyMap[doc.id] = new Set()
        })

        unavailable.doctorLeaves.forEach(leave => {
            if (doctorBusyMap[leave.doctorId]) {
                if (leave.shift === null) {
                    ALL_SHIFTS.forEach(shift => doctorBusyMap[leave.doctorId].add(shift))
                } else {
                    doctorBusyMap[leave.doctorId].add(leave.shift)
                }
            }
        })

        unavailable.bookedShifts.forEach(app => {
            if (doctorBusyMap[app.doctorId]) {
                doctorBusyMap[app.doctorId].add(app.shift)
            }
        })

        const result = []

        ALL_SHIFTS.forEach(shift => {
            const availableDoctorsForShift = []
            
            targetDoctors.forEach(doc => {
                if (!doctorBusyMap[doc.id].has(shift)) {
                    availableDoctorsForShift.push({ doctorId: doc.id }) 
                }
            })

            if (availableDoctorsForShift.length > 0) {
                result.push({
                    shift: shift,
                    date: date,
                    availableDoctors: availableDoctorsForShift
                })
            }
        })

        return result
    },

    registerDoctorLeave: async (data) => {
        const { doctorId, date, shift, reason } = data;
        
        const startOfLeaveDate = toVNMidnight(date);
        const today = todayVN();
        if (startOfLeaveDate < today) {
            throw Object.assign(new Error("Không thể đăng ký nghỉ cho ngày đã qua!"), { statusCode: 400 });
        }

        const shiftStartHours = { 
            1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12, 
            7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18, 
            null: 7 
        }; 

        const targetTime = new Date(startOfLeaveDate);
        targetTime.setHours(shiftStartHours[shift] || 7, 0, 0, 0);

        const now = new Date();
        const diffInHours = (targetTime - now) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            throw Object.assign(
                new Error("Bạn phải đăng ký nghỉ trước ít nhất 24 tiếng so với giờ bắt đầu ca khám!"), 
                { statusCode: 400 }
            );
        }

        const appointmentsOnDate = await appointmentRepository.findByDoctorId({
            doctorId,
            date: startOfLeaveDate,
            limit: 100 
        });

        const conflictingAppointments = appointmentsOnDate.filter(app => {
            const isTargetShift = shift ? app.shift === shift : true;
            const isConflictingStatus = ['pending', 'confirmed'].includes(app.status);
            return isTargetShift && isConflictingStatus;
        });

        if (conflictingAppointments.length > 0) {
            throw Object.assign(
                new Error(`Đã có ${conflictingAppointments.length} lịch hẹn đã được đặt. Vui lòng xử lý hủy hoặc dời lịch trước khi báo nghỉ!`), 
                { statusCode: 409 }
            );
        }

        const duplicate = await appointmentRepository.findExistingLeave(doctorId, startOfLeaveDate, shift);
        
        if (duplicate) {
            throw Object.assign(new Error("Bạn đã đăng ký lịch nghỉ này trước đó rồi."), { statusCode: 409 });
        }

        return await appointmentRepository.createLeave({ 
            doctorId, 
            date: startOfLeaveDate, 
            shift, 
            reason 
        });
    },

    cancelDoctorLeave: async (leaveId, doctorId) => {
        const leave = await appointmentRepository.findLeaveById(leaveId);

        if (!leave) {
            throw Object.assign(new Error("Không tìm thấy lịch nghỉ này!"), { statusCode: 404 });
        }

       

        const leaveDate = new Date(leave.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (leaveDate < today) {
            throw Object.assign(new Error("Không thể hủy lịch nghỉ của ngày đã qua!"), { statusCode: 400 });
        }

        await appointmentRepository.deleteLeave(leaveId);

        return true;
    },

    bookAppointment: async (data) => {
        const { doctorId, date, shift, reason, patientId } = data 
        
        const appointmentDate = toVNMidnight(date)
        const today = todayVN()

        if (appointmentDate < today) {
            throw Object.assign(new Error("Không thể đặt lịch khám đã qua!"), { statusCode: 400 })
        }

        if (shift < 1 || shift > 12) {
            throw Object.assign(new Error("Ca khám không hợp lệ (chỉ từ 1 đến 12)!"), { statusCode: 400 })
        }

        try {
            const newAppointment = await appointmentRepository.create({
                patientId,
                doctorId,
                date, 
                shift, 
                reason
            })

            return {
                appointmentId: newAppointment.id,
                status: newAppointment.status
            }
        } catch (error) {
            // Bắt lỗi unique constraint (P2002 từ Prisma)
            if (error.code === 'P2002' && error.meta?.target?.includes('unique_doctor_slot')) {
                throw Object.assign(
                    new Error("Ca khám này đã có bác sĩ đặt rồi. Vui lòng chọn ca khám khác!"), 
                    { statusCode: 409 }
                )
            }
            // Nếu không phải lỗi unique constraint, throw lại
            throw error
        }
    },

    cancelAppointment: async (id) => {
        const appointment = await appointmentRepository.findById(id)
        
        if (!appointment) {
            throw Object.assign(new Error("Không tìm thấy lịch khám hoặc lịch đã bị hủy!"), { statusCode: 404 })
        }
        if (appointment.status === "completed") {
            throw Object.assign(new Error("Lịch khám đã hoàn thành, không thể hủy!"), { statusCode: 400 })
        }
        
        const appointmentDate = new Date(appointment.date)  
        const now = new Date()

        const diffInHours = (appointmentDate - now) / (1000 * 60 * 60)

        if (diffInHours < 24) {
            throw Object.assign(new Error("Chỉ có thể tự hủy lịch trước ngày khám ít nhất 24 tiếng. Vui lòng gọi điện cho phòng khám để được hỗ trợ!"), { statusCode: 400 })
        }

        await appointmentRepository.updateStatus(id, "cancelled")
        return true
    },

    updateAppointmentStatus: async (id, status) => {
        const existingAppointment = await appointmentRepository.findById(id)
        
        if (!existingAppointment) {
            throw Object.assign(new Error("Không tìm thấy lịch khám hoặc lịch đã bị hủy!"), { statusCode: 404 })
        }

        if (existingAppointment.status === "completed") {
            throw Object.assign(new Error("Lịch khám này đã hoàn thành, không thể thay đổi trạng thái!"), { statusCode: 400 })
        }

        const updatedAppointment = await appointmentRepository.updateStatus(id, status)
        return updatedAppointment
    }
}