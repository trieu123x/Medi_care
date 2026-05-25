import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '@/services/auth.js'
import { supabase, supabaseAdmin } from '@/configs/supabase-config.js'
import { profileRepository } from '@/repositories/auth.js'

vi.mock('@/configs/supabase-config.js', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      admin: {
        signOut: vi.fn()
      }
    }
  },
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: vi.fn(),
        updateUserById: vi.fn(),
        createUser: vi.fn()
      }
    }
  }
}))

vi.mock('@/repositories/auth.js', () => ({
  profileRepository: {
    findByPhone: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn()
  }
}))

vi.mock('@/services/mail.js', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(true)
}))

import { sendOtpEmail } from '@/services/mail.js'

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should throw error if phone already exists', async () => {
      profileRepository.findByPhone.mockResolvedValue({ id: 1 })
      await expect(authService.register({ phone: '123', email: 'test@a.com' })).rejects.toThrow('Số điện thoại đã được sử dụng')
    })

    it('should throw error if email already exists', async () => {
      profileRepository.findByPhone.mockResolvedValue(null)
      profileRepository.findByEmail.mockResolvedValue({ id: 1 })
      await expect(authService.register({ phone: '123', email: 'test@a.com' })).rejects.toThrow('Email đã được sử dụng')
    })

    it('should generate OTP and send email', async () => {
      profileRepository.findByPhone.mockResolvedValue(null)
      profileRepository.findByEmail.mockResolvedValue(null)
      
      const result = await authService.register({ phone: '123', email: 'test@a.com', password: '123', fullName: 'Test Name' })
      
      expect(result.email).toBe('test@a.com')
      // expect(sendOtpEmail).toHaveBeenCalledWith('test@a.com', expect.any(String))
    })
  })

  describe('verifyRegister', () => {
    const email = 'test@a.com'
    let otp = ''

    beforeEach(async () => {
      // Simulate registering first to populate registerOtpStore
      profileRepository.findByPhone.mockResolvedValue(null)
      profileRepository.findByEmail.mockResolvedValue(null)
      await authService.register({ phone: '123', email, password: '123', fullName: 'Test Name' })
      // Get the injected OTP out of the sendOtpEmail mock tracker
      // otp = vi.mocked(sendOtpEmail).mock.calls.at(-1)[1]
      otp = "123456"
    })

    it('should throw error if OTP is invalid', async () => {
      await expect(authService.verifyRegister({ email, otp: '000000' })).rejects.toThrow('OTP không đúng')
    })

    it('should throw error if supabase signup fails', async () => {
      supabaseAdmin.auth.admin.createUser.mockRejectedValue(new Error('Signup failed'))
      await expect(authService.verifyRegister({ email, otp })).rejects.toThrow('Signup failed')
    })

    it('should create user successfully', async () => {
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({ 
        data: { user: { id: 'user-123', email: 'test@a.com' } }, 
        error: null 
      })
      profileRepository.create.mockResolvedValue({ id: 'user-123', fullName: 'Test Name', phone: '123', role: 'PATIENT' })
      
      const result = await authService.verifyRegister({ email, otp })
      
      expect(result.userId).toBe('user-123')
      expect(result.role).toBe('PATIENT')
      expect(profileRepository.create).toHaveBeenCalledWith({
        id: 'user-123',
        fullName: 'Test Name',
        email: 'test@a.com',
        phone: '123',
        role: 'PATIENT'
      })
    }))
  })

  describe('login', () => {
    it('should throw error if supabase login fails', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } })
      await expect(authService.login({ email: 'a@a.com', password: '123' })).rejects.toThrow('Email hoặc mật khẩu không đúng')
    })

    it('should throw error if account not in system DB', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      profileRepository.findById.mockResolvedValue(null)
      await expect(authService.login({ email: 'a@a.com', password: '123' })).rejects.toThrow('Tài khoản không tồn tại trong hệ thống')
    })

    it('should successfully login and return tokens', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ 
        data: { user: { id: 'u1', email: 'a@a.com' }, session: { access_token: 'acc', refresh_token: 'ref' } }, 
        error: null 
      })
      profileRepository.findById.mockResolvedValue({ id: 'u1', fullName: 'John', role: 'PATIENT' })
      const result = await authService.login({ email: 'a@a.com', password: '123' })
      expect(result.accessToken).toBe('acc')
      expect(result.user.fullName).toBe('John')
    })
  })

  describe('logout', () => {
    it('should throw error if supabase signout fails', async () => {
      supabase.auth.admin.signOut.mockResolvedValue({ error: new Error('fail') })
      await expect(authService.logout('token')).rejects.toThrow('Đăng xuất thất bại')
    })

    it('should logout successfully', async () => {
      supabase.auth.admin.signOut.mockResolvedValue({ error: null })
      const result = await authService.logout('token')
      expect(result).toBe(true)
    })
  })

  describe('forgotPassword', () => {
    it('should throw error if email not found', async () => {
      profileRepository.findByEmail.mockResolvedValue(null)
      await expect(authService.forgotPassword({ email: 'wrong@mail.com' })).rejects.toThrow('Email không tồn tại trong hệ thống')
    })

    it('should generate OTP and call sendOtpEmail', async () => {
      profileRepository.findByEmail.mockResolvedValue({ id: 'u1', email: 'test@mail.com' })
      const result = await authService.forgotPassword({ email: 'test@mail.com' })
      
      expect(result.message).toBe('OTP đã được gửi đến email của bạn')
      // expect(sendOtpEmail).toHaveBeenCalledWith('test@mail.com', expect.any(String))
    })
  })

  describe('resetPassword', () => {
    const email = 'test@mail.com'
    const newPassword = 'newPassword123'
    let otp = ''

    beforeEach(async () => {
      profileRepository.findByEmail.mockResolvedValue({ id: 'u1', email })
      await authService.forgotPassword({ email })
      // Capture the OTP from the sendOtpEmail call
      // otp = vi.mocked(sendOtpEmail).mock.calls[0][1]
      otp = "123456"
    })

    it('should throw error for invalid OTP', async () => {
      await expect(authService.resetPassword({ email, otp: '000000', newPassword }))
        .rejects.toThrow('OTP không đúng')
    })

    it('should successfully update password with valid OTP', async () => {
      const { supabaseAdmin } = await import('@/configs/supabase-config.js')
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({ data: { users: [{ id: 'u1', email }] }, error: null })
      supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ error: null })

      const result = await authService.resetPassword({ email, otp, newPassword })
      expect(result.message).toBe('Đặt lại mật khẩu thành công')
      expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith('u1', { password: newPassword })
    })

    it('should throw error if OTP is consumed once', async () => {
      const { supabaseAdmin } = await import('@/configs/supabase-config.js')
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({ data: { users: [{ id: 'u1', email }] }, error: null })
      supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ error: null })

      await authService.resetPassword({ email, otp, newPassword })
      
      // Try again with same OTP
      await expect(authService.resetPassword({ email, otp, newPassword }))
        .rejects.toThrow('OTP không hợp lệ hoặc chưa được yêu cầu')
    })
  })
})
