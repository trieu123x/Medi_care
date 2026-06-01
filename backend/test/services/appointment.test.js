import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { appointmentService } from '@/services/appointment.js'
import { appointmentRepository } from '@/repositories/appointment.js'
import { prisma } from '@/configs/prisma-config.js'
import { eventService } from '@/services/event.js'

vi.mock('@/repositories/appointment.js', () => ({
  appointmentRepository: {
    getAllAppointments: vi.fn(),
    findById: vi.fn(),
    findByPatientId: vi.fn(),
    findByDoctorId: vi.fn(),
    getUnavailableSlots: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn()
  }
}))

vi.mock('@/configs/prisma-config.js', () => ({
  prisma: {
    profile: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('@/services/event.js', () => ({
  eventService: {
    track: vi.fn()
  }
}))

describe('appointmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getAllAppointments', () => {
    it('should map appointments correctly', async () => {
      const mockAppointments = [
        {
          id: 1,
          date: new Date('2023-12-01'), 
          shift: 1,
          status: 'pending',
          reason: 'sick',
          patient: { id: 2, fullName: 'John', phone: '123' },
          doctor: { id: 3, fullName: 'Dr. Smith', doctor: { specialty: { name: 'Cardio' } } }
        },
        {
          id: 2,
          date: new Date('2023-12-02'),
          shift: 2,
          status: 'confirmed',
          reason: 'checkup',
          patient: { id: 4, fullName: 'Jane', phone: '456' },
          doctor: { id: 5, fullName: 'Dr. Brown', doctor: { specialty: { name: 'Pediatric' } } }
        }
      ]
      appointmentRepository.getAllAppointments.mockResolvedValue(mockAppointments)

      const result = await appointmentService.getAllAppointments({})
      
      expect(result).toHaveLength(2)
      expect(result[0].appointmentId).toBe(1)
      expect(result[0].patient.name).toBe('John')
      expect(result[0].doctor.specialityName).toBe('Cardio')
      expect(result[1].appointmentId).toBe(2)
      expect(result[1].status).toBe('confirmed')
    })
  })

  describe('getAppointmentDetail', () => {
    it('should throw error if appointment not found', async () => {
      appointmentRepository.findById.mockResolvedValue(null)
      await expect(appointmentService.getAppointmentDetail(1)).rejects.toThrow('Không tìm thấy lịch khám hoặc lịch đã bị hủy!')
    })

    it('should return mapped appointment detail', async () => {
      appointmentRepository.findById.mockResolvedValue({
        id: 1,
        date: new Date('2023-12-01'), 
        shift: 1,
        status: 'pending',
        reason: 'sick',
        patient: { id: 2, fullName: 'John', phone: '123', dob: '1990-01-01' },
        doctor: { id: 3, fullName: 'Dr. Smith', doctor: { specialty: { name: 'Cardio' } } }
      })
      const result = await appointmentService.getAppointmentDetail(1)
      
      expect(result.appointmentId).toBe(1)
      expect(result.patient.name).toBe('John')
      expect(result.patient.userId).toBe(2) 
      expect(result.schedule.shift).toBe(1)
    })
  })

  describe('bookAppointment', () => {
    it('should throw error if booking past date', async () => {
      vi.setSystemTime(new Date('2023-12-02'))
      await expect(appointmentService.bookAppointment({ date: '2023-12-01', shift: 1 })).rejects.toThrow('Không thể đặt lịch khám đã qua!')
    })

    it('should throw error if shift is invalid', async () => {
      vi.setSystemTime(new Date('2023-12-01'))
      await expect(appointmentService.bookAppointment({ date: '2023-12-02', shift: 13 })).rejects.toThrow('Ca khám không hợp lệ (chỉ từ 1 đến 12)!')
    })

    it('should create new appointment successfully', async () => {
      vi.setSystemTime(new Date('2023-12-01'))
      
      appointmentRepository.create.mockResolvedValue({
        id: 10,
        status: 'pending',
        patientId: 2,
        doctorId: 1,
        date: new Date('2023-12-02'),
        shift: 1,
        reason: 'Checkup'
      })

      const result = await appointmentService.bookAppointment({
        doctorId: 1,
        date: '2023-12-02',
        shift: 1,
        patientId: 2,
        reason: 'Checkup'
      })
      
      expect(result.appointmentId).toBe(10)
      expect(result.status).toBe('pending')
      expect(appointmentRepository.create).toHaveBeenCalledWith({
        doctorId: 1,
        date: '2023-12-02',
        shift: 1,
        patientId: 2,
        reason: 'Checkup'
      })
    })
  })

  describe('cancelAppointment', () => {
    it('should throw if appointment not found', async () => {
      appointmentRepository.findById.mockResolvedValue(null)
      await expect(appointmentService.cancelAppointment(1)).rejects.toThrow('Không tìm thấy lịch khám hoặc lịch đã bị hủy!')
    })

    it('should throw if appointment is already completed', async () => {
      appointmentRepository.findById.mockResolvedValue({ id: 1, status: 'completed' })
      await expect(appointmentService.cancelAppointment(1)).rejects.toThrow('Lịch khám đã hoàn thành, không thể hủy!')
    })

    it('should throw if within 24 hours', async () => {
      vi.setSystemTime(new Date('2023-12-01T10:00:00Z'))
      appointmentRepository.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        date: new Date('2023-12-01T15:00:00Z') 
      })
      await expect(appointmentService.cancelAppointment(1)).rejects.toThrow('Chỉ có thể tự hủy lịch trước ngày khám ít nhất 24 tiếng')
    })

    it('should cancel appointment successfully', async () => {
      vi.setSystemTime(new Date('2023-12-01T10:00:00Z'))
      appointmentRepository.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        date: new Date('2023-12-03T10:00:00Z') 
      })
      appointmentRepository.updateStatus.mockResolvedValue({ id: 1, status: 'cancelled' })
      
      const result = await appointmentService.cancelAppointment(1)
      expect(result).toBe(true)
      expect(appointmentRepository.updateStatus).toHaveBeenCalledWith(1, 'cancelled')
    })
  })

  describe('updateAppointmentStatus', () => {
    it('should throw if appointment not found', async () => {
      appointmentRepository.findById.mockResolvedValue(null)
      await expect(appointmentService.updateAppointmentStatus(1, 'confirmed')).rejects.toThrow('Không tìm thấy lịch khám hoặc lịch đã bị hủy!')
    })

    it('should throw if appointment is already completed', async () => {
      appointmentRepository.findById.mockResolvedValue({ id: 1, status: 'completed' })
      await expect(appointmentService.updateAppointmentStatus(1, 'cancelled')).rejects.toThrow('Lịch khám này đã hoàn thành, không thể thay đổi trạng thái!')
    })

    it('should update appointment status successfully', async () => {
      appointmentRepository.findById.mockResolvedValue({ id: 1, status: 'pending' })
      appointmentRepository.updateStatus.mockResolvedValue({
        id: 1,
        status: 'confirmed'
      })
      
      const result = await appointmentService.updateAppointmentStatus(1, 'confirmed')
      expect(result.id).toBe(1)
      expect(result.status).toBe('confirmed')
    })
  })

  describe('bookAppointment - Unique Constraint', () => {
    it('should throw error 409 when unique constraint is violated', async () => {
      vi.setSystemTime(new Date('2026-05-24'))  // Hôm trước ngày đặt
      
      const data = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: '2026-05-25',
        shift: 3,
        reason: 'Khám sức khỏe'
      }

      // Giả lập Prisma error P2002 - unique constraint
      const prismaError = new Error('Unique constraint failed on the fields: (`doctor_id`,`date`,`shift`)')
      prismaError.code = 'P2002'
      prismaError.meta = {
        target: ['unique_doctor_slot']
      }

      appointmentRepository.create.mockRejectedValueOnce(prismaError)

      try {
        await appointmentService.bookAppointment(data)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.statusCode).toBe(409)
        expect(error.message).toContain('Ca khám này đã có bác sĩ đặt rồi')
      }
    })

    it('should throw other errors that are not unique constraint violation', async () => {
      vi.setSystemTime(new Date('2026-05-24'))  // Hôm trước ngày đặt
      
      const data = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: '2026-05-25',
        shift: 3,
        reason: 'Khám sức khỏe'
      }

      const otherError = new Error('Database connection failed')
      otherError.code = 'P0000'

      appointmentRepository.create.mockRejectedValueOnce(otherError)

      await expect(appointmentService.bookAppointment(data)).rejects.toThrow('Database connection failed')
    })
  })
})