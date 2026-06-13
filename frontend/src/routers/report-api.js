import axiosInstance from '@/utils/axios'

export const getReportsByTimeRange = async (reportName, startDate, endDate, mode = "daily") => {
  return await axiosInstance.get('/report/by-time', {
    params: {
      reportName,
      mode,
      startDate,
      endDate
    }
  })
}

export const getReportById = async (id) => {
  return await axiosInstance.get(`/report/${id}`)
}

export const getLiveStats = async (startDate, endDate) => {
  return await axiosInstance.get('/report/live', {
    params: { startDate, endDate }
  })
}