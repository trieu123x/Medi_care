import { catchError } from "../helpers/catch-error.js"
import { reportService } from "../services/report.js"

export const getReportByTime = catchError(async (req, res) => {
    const { reportName, mode, startDate, endDate } = req.query;
    const reports = await reportService.getReportsByTimeRange({ reportName, mode, startDate, endDate });

    res.status(200).json({
        success: true,
        message: "Lấy danh sách báo cáo thành công",
        data: reports
    });
});

export const getReportById = catchError(async (req, res) => {
    const { id } = req.params

    const report = await reportService.getReportById(id);
    res.status(200).json({
        success: true,
        message: "Lấy chi tiết báo cáo thành công",
        data: report
    });
});

export const getLiveStats = catchError(async (req, res) => {
    const { startDate, endDate } = req.query;
    const data = await reportService.getLiveStats({ startDate, endDate });
    res.status(200).json({
        success: true,
        message: "Lấy thống kê thời gian thực thành công",
        data
    });
});