import { appointmentService } from "../services/appointment.js"
import { catchError } from "../helpers/catch-error.js"

export const bookAppointment = catchError(async (req, res) => {
    const { doctorId, date, shift, reason } = req.body 
    const patientId = req.user.id
    if (!patientId || patientId === 'undefined' || patientId === 'null') {
        throw Object.assign(new Error("Không tìm thấy thông tin bệnh nhân!"), { statusCode: 403 })
    }
    if (!doctorId || doctorId === 'undefined' || doctorId === 'null') {
        throw Object.assign(new Error("Không tìm thấy thông tin bác sĩ!"), { statusCode: 403 })
    }
    if (patientId === doctorId) {
        throw Object.assign(new Error("Không thể đặt lịch khám cho chính mình!"), { statusCode: 403 })
    }
    const data = await appointmentService.bookAppointment({ 
        patientId, 
        doctorId, 
        date, 
        shift, 
        reason 
    })
    
    res.status(201).json({
        success: true,
        message: "Đặt lịch khám thành công. Vui lòng chờ bác sĩ xác nhận.",
        data
    })
})

export const getAllAppointments = catchError(async (req, res) => {
    const { date, status, lastId, limit, desc } = req.query
    
    const data = await appointmentService.getAllAppointments({ 
        date,
        status,
        lastId,
        limit: limit ? parseInt(limit) : 30,
        desc: desc === 'false' ? false : true 
    })

    res.status(200).json({
        success: true,
        message: "Lấy danh sách toàn bộ lịch khám thành công",
        data
    })
})

export const getAvailableSlots = catchError(async (req, res) => {
    const { date, doctorId, patientId } = req.query; 
    
    const requesterId = req.user?.id; 
    const finalPatientId = patientId || requesterId;

    const data = await appointmentService.getAvailableSlots({ 
        date, 
        doctorId,
        patientId: finalPatientId 
    });

    res.status(200).json({
        success: true,
        message: "Lấy danh sách giờ trống thành công",
        data
    });
})

export const getAppointmentDetail = catchError(async (req, res) => {
    const { appointmentId } = req.params
    const requesterId = req.user.id
    const requesterRole = req.user.profile.role

    const data = await appointmentService.getAppointmentDetail(appointmentId)

    if (requesterRole === 'PATIENT' && data.patient?.userId !== requesterId) {
        throw Object.assign(new Error("Bạn không có quyền xem thông tin lịch khám của người khác."), { statusCode: 403 })
    }
    if (requesterRole === 'DOCTOR' && data.doctor?.doctorId !== requesterId) {
        throw Object.assign(new Error("Bạn không có quyền xem lịch khám của bác sĩ khác."), { statusCode: 403 })
    }
    
    res.status(200).json({
        success: true,
        message: "Lấy thông tin lịch khám thành công",
        data
    })
})

export const getPatientHistory = catchError(async (req, res) => {
    const { userId } = req.params 
    const { lastId, limit, desc } = req.query
    const requesterId = req.user.id
    const requesterRole = req.user.profile.role

    if (requesterRole === 'PATIENT' && userId !== requesterId) {
        throw Object.assign(new Error("Bạn chỉ có thể xem lịch sử khám của chính mình."), { statusCode: 403 })
    }
    
    const data = await appointmentService.getPatientHistory({ 
        patientId: userId,
        lastId,
        limit: limit ? parseInt(limit) : 20,
        desc: desc === 'false' ? false : true 
    })

    res.status(200).json({
        success: true,
        message: "Lấy danh sách lịch sử khám thành công",
        data
    })
})

export const getDoctorSchedule = catchError(async (req, res) => {
    const { doctorId } = req.params 
    const { date, lastId, limit, desc } = req.query
    
    const data = await appointmentService.getDoctorSchedule({ 
        doctorId,
        date,
        lastId,
        limit: limit ? parseInt(limit) : 30,
        desc: desc === 'false' ? false : true 
    })

    res.status(200).json({
        success: true,
        message: "Lấy danh sách lịch khám của bác sĩ thành công",
        data
    })
})

export const getDoctorLeaves = catchError(async (req, res) => {
    const { doctorId } = req.params; 
    
    const requesterId = req.user.id;
    const requesterRole = req.user.profile.role;

    if (!doctorId) {
        throw Object.assign(new Error("Vui lòng cung cấp ID của bác sĩ!"), { statusCode: 400 });
    }

    if (requesterRole === 'DOCTOR' && doctorId !== requesterId) {
        throw Object.assign(new Error("Bạn không có quyền xem lịch nghỉ của bác sĩ khác."), { statusCode: 403 });
    }

    const data = await appointmentService.getDoctorLeaves(doctorId);

    res.status(200).json({
        success: true,
        message: "Lấy danh sách lịch nghỉ thành công.",
        data
    });
})

export const cancelAppointment = catchError(async (req, res) => {
    const { appointmentId } = req.params
    const requesterId = req.user.id
    const requesterRole = req.user.profile.role

    if (requesterRole === 'PATIENT') {
        const existingAppointment = await appointmentService.getAppointmentDetail(appointmentId)
        
         if (existingAppointment.patient?.userId !== requesterId) {
             throw Object.assign(new Error("Bạn chỉ có thể hủy lịch cho chính mình."), { statusCode: 403 })
         }
     }

    await appointmentService.cancelAppointment(appointmentId)
    
    res.status(200).json({
        success: true,
        message: "Hủy lịch khám thành công."
    })
})

export const registerDoctorLeave = catchError(async (req, res) => {
    const { date, shift, reason } = req.body
    
    const doctorId = req.user.id 
    
    const data = await appointmentService.registerDoctorLeave({
        doctorId,
        date,
        shift,
        reason
    })

    res.status(201).json({
        success: true,
        message: "Đăng ký lịch nghỉ thành công.",
        data
    })
})

export const cancelDoctorLeave = catchError(async (req, res) => {
    const { leaveId } = req.params;
    const doctorId = req.user.id; 

    await appointmentService.cancelDoctorLeave(leaveId, doctorId);

    res.status(200).json({
        success: true,
        message: "Hủy lịch nghỉ thành công."
    });
});

export const updateAppointmentStatus = catchError(async (req, res) => {
    const { appointmentId } = req.params
    const { status } = req.body
    const requesterId = req.user.id
    const requesterRole = req.user.profile.role

    if (requesterRole === 'DOCTOR') {
        const existingAppointment = await appointmentService.getAppointmentDetail(appointmentId)
        if (existingAppointment.doctor?.doctorId !== requesterId) {
            throw Object.assign(new Error("Bạn không có quyền cập nhật lịch khám của bác sĩ khác."), { statusCode: 403 })
        }
    }

    const data = await appointmentService.updateAppointmentStatus(appointmentId, status)
    
    res.status(200).json({
        success: true,
        message: "Cập nhật trạng thái lịch khám thành công.",
        data
    })
})