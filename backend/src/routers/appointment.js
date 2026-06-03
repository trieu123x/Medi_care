import express from "express"
import { bookAppointment, getAvailableSlots, getAppointmentDetail, getPatientHistory, cancelAppointment, updateAppointmentStatus, getDoctorSchedule, getAllAppointments, registerDoctorLeave, cancelDoctorLeave, getDoctorLeaves} from "../controllers/appointment.js"
import { authenticate, authorizeRoles } from "../middlewares/authenticate.js"
import { createMedicalRecord, getMedicalRecordDetail, updateMedicalRecord } from "../controllers/medical-record.js"
import { validate } from "../middlewares/validate-handler.js"
import { appointmentSchema } from "../validates/appointment.js"
import { medicalRecordSchema } from "../validates/medical-record.js"

const router = express.Router()

// Lấy lịch khám trống
router.get("/slots", validate(appointmentSchema.getSlots), getAvailableSlots)
// Đặt lịch
router.post("/book", authenticate, authorizeRoles('PATIENT', 'ADMIN','DOCTOR'), validate(appointmentSchema.bookAppointment), bookAppointment)
// Lấy danh sách các lịch khám
router.get("/all", authenticate, authorizeRoles('ADMIN', 'DOCTOR'), validate(appointmentSchema.getAll), getAllAppointments)
// Xem lịch khám của bệnh nhân
router.get("/patient/:userId", authenticate, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), validate(appointmentSchema.getHistory), getPatientHistory)
// Xem lịch khám theo bác sĩ
router.get("/doctor/:doctorId", authenticate, authorizeRoles('ADMIN', 'DOCTOR'), validate(appointmentSchema.getDoctorSchedule), getDoctorSchedule)
router.patch("/cancel/:appointmentId", authenticate, authorizeRoles('PATIENT', 'ADMIN'), validate(appointmentSchema.checkParamId), cancelAppointment)
router.patch("/update/status/:appointmentId", authenticate, authorizeRoles('ADMIN', 'DOCTOR'), validate(appointmentSchema.updateStatus), updateAppointmentStatus)
// Medical Record
router.post("/medical-record/create/:appointmentId", authenticate, authorizeRoles('DOCTOR'), validate(medicalRecordSchema.create), createMedicalRecord)
router.get("/medical-record/:appointmentId", authenticate, authorizeRoles('DOCTOR', 'PATIENT'), validate(medicalRecordSchema.getDetail), getMedicalRecordDetail)
router.patch("/medical-record/update/:appointmentId", authenticate, authorizeRoles('DOCTOR'), validate(medicalRecordSchema.update), updateMedicalRecord)

// Đăng ký nghỉ và hủy nghỉ — đặt TRƯỚC /:appointmentId để không bị bắt nhầm
router.post("/leave", authenticate, authorizeRoles('DOCTOR'), validate(appointmentSchema.registerLeave), registerDoctorLeave)
router.delete("/leave/:leaveId", authenticate, authorizeRoles('DOCTOR'), validate(appointmentSchema.cancelLeave), cancelDoctorLeave)
router.get("/leaves/:doctorId", authenticate, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), validate(appointmentSchema.getLeaves), getDoctorLeaves)

// Route động 
router.get("/:appointmentId", authenticate, authorizeRoles('ADMIN', 'DOCTOR', 'PATIENT'), validate(appointmentSchema.checkParamId), getAppointmentDetail)

export default router