import { reportRepository } from "../repositories/report.js"

export const reportService = {
    getReportsByTimeRange: async ({ reportName, mode, startDate, endDate }) => {
        const reports = await reportRepository.getReportsByTimeRange({ reportName, mode, startDate, endDate });
        // Không có data là trạng thái hợp lệ — trả mảng rỗng thay vì throw 404
        return reports || [];
    },

    getReportById: async (id) => {
        const report = await reportRepository.getReportById(id);
        if (!report) {
            const err = Object.assign(new Error("Không tìm thấy báo cáo"), { statusCode: 404 });
            throw err;
        }

        return report;
    },

    getLiveStats: async ({ startDate, endDate }) => {
        if (!startDate || !endDate) {
            throw Object.assign(new Error("Cần cung cấp startDate và endDate"), { statusCode: 400 });
        }
        return await reportRepository.getLiveStats({ startDate, endDate });
    }
}