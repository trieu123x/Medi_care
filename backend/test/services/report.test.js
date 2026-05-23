import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reportService } from '@/services/report.js'
import { reportRepository } from '@/repositories/report.js'

vi.mock('@/repositories/report.js', () => ({
  reportRepository: {
    getReportsByTimeRange: vi.fn(),
    getReportById: vi.fn()
  }
}))

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getReportsByTimeRange', () => {
    it('nên trả về danh sách report khi repository tìm thấy dữ liệu', async () => {
      const params = { reportName: 'daily_summary', mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-29' }

      const mockReports = [
        { id: 1, ...params, totalEvents: 100 },
        { id: 2, ...params, totalEvents: 150 }
      ]
      reportRepository.getReportsByTimeRange.mockResolvedValue(mockReports)

      const result = await reportService.getReportsByTimeRange(params)

      expect(reportRepository.getReportsByTimeRange).toHaveBeenCalledWith(params)
      expect(result).toEqual(mockReports)
    })

    it('nên throw lỗi 404 khi mảng trả về rỗng (không có data trong khoảng thời gian này)', async () => {
      reportRepository.getReportsByTimeRange.mockResolvedValue([])

      const result = await reportService.getReportsByTimeRange({
        reportName: 'daily_summary',
        mode: 'daily',
        startDate: '2026-03-01',
        endDate: '2026-03-29'
      })
      expect(result).toEqual([])
    })

    it('nên throw lỗi 404 khi repository trả về array rỗng', async () => {
      reportRepository.getReportsByTimeRange.mockResolvedValue([])

      const result = await reportService.getReportsByTimeRange({
        reportName: 'daily_summary',
        mode: 'daily',
        startDate: '2026-03-01',
        endDate: '2026-03-29'
      })
      expect(result).toEqual([])
    })
  })

  describe('getReportById', () => {
    it('nên trả về report khi tìm thấy id', async () => {
      const mockReport = { id: '99', reportName: 'daily_summary' }
      reportRepository.getReportById.mockResolvedValue(mockReport)

      const result = await reportService.getReportById('99')

      expect(reportRepository.getReportById).toHaveBeenCalledWith('99')
      expect(result).toEqual(mockReport)
    })

    it('nên throw lỗi 404 khi không tìm thấy id', async () => {
      reportRepository.getReportById.mockResolvedValue(null)

      await expect(reportService.getReportById('404-uuid')).rejects.toMatchObject({
        statusCode: 404
      })
    })
  })
})