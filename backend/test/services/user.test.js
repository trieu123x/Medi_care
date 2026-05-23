import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userService } from '@/services/user.js'
import { userRepository } from '@/repositories/user.js'

vi.mock('@/repositories/user.js', () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('@/configs/prisma-config.js', () => ({
  prisma: {
    notification: { deleteMany: vi.fn() },
    medicalRecord: { deleteMany: vi.fn() },
    appointment: { deleteMany: vi.fn() }
  }
}))

vi.mock('@/configs/supabase-config.js', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        deleteUser: vi.fn()
      }
    }
  }
}))

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllUsers', () => {
    it('should throw if not admin or doctor', async () => {
      await expect(userService.getAllUsers('patient')).rejects.toThrow('Không có quyền truy cập')
    })

    it('should return filtered list for doctor', async () => {
      userRepository.findAll.mockResolvedValue({ users: [{ id: 1 }], total: 2 })
      const res = await userService.getAllUsers('DOCTOR', 1, 10)
      expect(res.users).toHaveLength(1)
      expect(userRepository.findAll).toHaveBeenCalledWith({ role: 'PATIENT' }, 0, 10)
    })

    it('should return all for admin', async () => {
      userRepository.findAll.mockResolvedValue({ users: [{ id: 1 }], total: 2 })
      await userService.getAllUsers('ADMIN', 1, 10)
      expect(userRepository.findAll).toHaveBeenCalledWith({}, 0, 10)
    })
  })

  describe('getUserById', () => {
    it('should throw if not found', async () => {
      userRepository.findById.mockResolvedValue(null)
      await expect(userService.getUserById(1, 'admin', 99)).rejects.toThrow('Không tìm thấy người dùng')
    })

    it('should throw if patient viewing another patient', async () => {
      userRepository.findById.mockResolvedValue({ id: 2, role: 'PATIENT' })
      await expect(userService.getUserById(2, 'PATIENT', 1)).rejects.toThrow('Không có quyền xem')
    })

    it('should return doctor if patient views doctor', async () => {
      userRepository.findById.mockResolvedValue({ id: 2, role: 'DOCTOR' })
      const res = await userService.getUserById(2, 'PATIENT', 1)
      expect(res.id).toBe(2)
    })

    it('should return self if patient views self', async () => {
      userRepository.findById.mockResolvedValue({ id: 1, role: 'PATIENT' })
      const res = await userService.getUserById(1, 'PATIENT', 1)
      expect(res.id).toBe(1)
    })
  })

  describe('updateUser', () => {
    it('should throw if updating someone else', async () => {
      await expect(userService.updateUser(1, 2, {})).rejects.toThrow('Chỉ có thể cập nhật thông tin của chính mình')
    })

    it('should filter out restricted fields and update', async () => {
      userRepository.update.mockResolvedValue({ id: 1, name: 'A' })
      const res = await userService.updateUser(1, 1, { id: 2, role: 'admin', name: 'A', dob: '2020-01-01' })
      
      expect(res.name).toBe('A')
      expect(userRepository.update).toHaveBeenCalledWith(1, { name: 'A', dob: new Date('2020-01-01') }, null)
    })
  })

  describe('toggleBlockUser', () => {
    it('should throw if user not found', async () => {
      userRepository.findById.mockResolvedValue(null)
      await expect(userService.toggleBlockUser(1, true)).rejects.toThrow('Không tìm thấy người dùng')
    })

    it('should update isActive', async () => {
      userRepository.findById.mockResolvedValue({ id: 1 })
      userRepository.update.mockResolvedValue({ id: 1, isActive: false })
      const res = await userService.toggleBlockUser(1, false)
      expect(res.isActive).toBe(false)
      expect(userRepository.update).toHaveBeenCalledWith(1, { isActive: false })
    })
  })

  describe('deleteUser', () => {
    it('should throw if user not found', async () => {
      userRepository.findById.mockResolvedValue(null)
      await expect(userService.deleteUser(1)).rejects.toThrow('Không tìm thấy người dùng')
    })

    it('should delete from supabase and DB', async () => {
      userRepository.findById.mockResolvedValue({ id: 1 })
      userRepository.delete.mockResolvedValue(true)
      
      const { supabaseAdmin } = await import('@/configs/supabase-config.js')
      supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({})

      const res = await userService.deleteUser(1)
      expect(res).toBe(true)
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(1)
      expect(userRepository.delete).toHaveBeenCalledWith(1)
    })
  })
})
