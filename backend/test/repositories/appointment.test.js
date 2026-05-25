import { describe, it, expect, vi, beforeEach } from 'vitest'
import { appointmentRepository } from '@/repositories/appointment.js'
import { prisma } from '@/configs/prisma-config.js'

vi.mock('@/configs/prisma-config.js', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn()
    },
    doctorLeave: {
      findMany: vi.fn()
    }
  }
}))

describe('appointmentRepository.getUnavailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return bookedShifts and doctorLeaves for a specific date', async () => {
    const mockAppointments = [
      { shift: 1, doctorId: 'doctor-1' },
      { shift: 2, doctorId: 'doctor-1' },
      { shift: 3, doctorId: 'doctor-2' }
    ]

    const mockLeaves = [
      { shift: null, doctorId: 'doctor-3' }, // cả ngày
      { shift: 4, doctorId: 'doctor-1' },
      { shift: 5, doctorId: 'doctor-2' }
    ]

    prisma.appointment.findMany.mockResolvedValue(mockAppointments)
    prisma.doctorLeave.findMany.mockResolvedValue(mockLeaves)

    const result = await appointmentRepository.getUnavailableSlots({
      date: '2026-05-25',
      doctorId: 'doctor-1'
    })

    console.log('=== RESULT ===')
    console.log('bookedShifts:', result.bookedShifts)
    console.log('doctorLeaves:', result.doctorLeaves)

    expect(result).toEqual({
      bookedShifts: mockAppointments,
      doctorLeaves: mockLeaves
    })

    expect(result.bookedShifts).toHaveLength(3)
    expect(result.doctorLeaves).toHaveLength(3)
  })

  it('should return empty arrays when no appointments or leaves', async () => {
    prisma.appointment.findMany.mockResolvedValue([])
    prisma.doctorLeave.findMany.mockResolvedValue([])

    const result = await appointmentRepository.getUnavailableSlots({
      date: '2026-05-25'
    })

    console.log('=== EMPTY RESULT ===')
    console.log('bookedShifts:', result.bookedShifts)
    console.log('doctorLeaves:', result.doctorLeaves)

    expect(result.bookedShifts).toEqual([])
    expect(result.doctorLeaves).toEqual([])
  })

  it('should filter by doctorId when provided', async () => {
    const mockAppointments = [
      { shift: 1, doctorId: 'doctor-1' },
      { shift: 2, doctorId: 'doctor-1' }
    ]

    const mockLeaves = [
      { shift: 3, doctorId: 'doctor-1' }
    ]

    prisma.appointment.findMany.mockResolvedValue(mockAppointments)
    prisma.doctorLeave.findMany.mockResolvedValue(mockLeaves)

    const result = await appointmentRepository.getUnavailableSlots({
      date: '2026-05-25',
      doctorId: 'doctor-1'
    })

    console.log('=== FILTERED BY DOCTOR ===')
    console.log('bookedShifts:', result.bookedShifts)
    console.log('doctorLeaves:', result.doctorLeaves)

    // Verify prisma was called with correct whereBase
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          doctorId: 'doctor-1'
        })
      })
    )

    expect(result.bookedShifts).toHaveLength(2)
    expect(result.doctorLeaves).toHaveLength(1)
  })
})
