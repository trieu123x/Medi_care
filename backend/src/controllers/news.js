import { newsService } from "../services/news.js";
import { catchError } from "../helpers/catch-error.js";

export const getTotalNews = catchError(async (req, res) => {
    const total = await newsService.getTotalCount()
    res.status(200).json({
        success: true,
        data: { total }
    })
})

export const getNewsForAdmin = catchError(async (req, res) => {
    const { title, page, date, limit } = req.query
    const data = await newsService.getNewsForAdmin({
        title,
        page: page ? parseInt(page) : 1,
        date,
        limit: limit ? parseInt(limit) : 30
    })
    res.status(200).json({
        success: true,
        message: "Lấy danh sách tin tức cho admin thành công",
        data
    })
})

export const createNews = catchError(async (req, res) => {
    const newsData = req.body
    const file = req.file

    const data = await newsService.createNews(newsData, file)
    res.status(201).json({
        success: true,
        message: "Tạo tin tức mới thành công",
        data
    })
})

export const getNewsList = catchError(async (req, res) => {
    const { title, page, date, limit } = req.query;

    const filter = {
        title: title || undefined,
        page: page ? parseInt(page, 10) : 1,
        date: date || undefined,
        limit: limit ? parseInt(limit, 10) : 10
    };

    const data = await newsService.getNewsList(filter);

    res.status(200).json({
        success: true,
        message: "Lấy danh sách tin tức thành công",
        data
    });
});

export const getNewsDetail = catchError(async (req, res) => {
    const { newsId } = req.params;

    const data = await newsService.getNewsDetail(newsId);

    res.status(200).json({
        success: true,
        message: "Lấy chi tiết tin tức thành công",
        data
    });
});

export const updateNews = catchError(async (req, res) => {
    const { newsId } = req.params
    const updateData = req.body
    const file = req.file

    const data = await newsService.updateNews(newsId, updateData, file)
    res.status(200).json({
        success: true,
        message: "Cập nhật tin tức thành công",
        data
    })
})

export const deleteNews = catchError(async (req, res) => {
    const { newsId } = req.params

    await newsService.deleteNews(newsId)
    res.status(200).json({
        success: true,
        message: "Xóa bài viết thành công"
    })
})