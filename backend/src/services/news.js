import { uploadHelper } from "../helpers/storage-helper.js";
import { newsRespository } from "../repositories/news.js";

export const newsService = {
    getTotalCount: async () => {
        return await newsRespository.countAll()
    },

    getNewsForAdmin: async (filters) => {
        const { items, total } = await newsRespository.findAllForAdmin(filters)
        const limit = filters.limit || 30
        const page = filters.page || 1
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
    },

    createNews: async (data, file) => {
        if (file) {
            const imageUrl = await uploadHelper.uploadFile(file, 'medicare', 'news');
            data.newUrl = imageUrl;
        }

        const newNews = await newsRespository.create(data);
        return newNews;
    },

    updateNews: async (id, data, file) => {
        const existingNews = await newsRespository.findById(id);
        if (!existingNews) {
            throw Object.assign(new Error("Không tìm thấy tin tức!"), { statusCode: 404 });
        }

        if (file) {
            if (existingNews.newUrl) {
                await uploadHelper.deleteFile(existingNews.newUrl, 'medicare');
            }

            const newImageUrl = await uploadHelper.uploadFile(file, 'medicare', 'news');
            data.newUrl = newImageUrl;
        }

        return await newsRespository.update(id, data);
    },

    getNewsList: async (filter) => {
        const { items, total } = await newsRespository.findWithFilter(filter)
        const limit = filter.limit || 10
        const page = filter.page || 1
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
    },

    getNewsDetail: async (id) => {
        const news = await newsRespository.findById(id)
        if (!news) {
            throw Object.assign(new Error("Không tìm thấy thông tin tin tức!"), { statusCode: 404 })
        }
        return news
    },

    deleteNews: async (id) => {
        const existing = await newsRespository.findById(id);
        if (!existing) {
            throw Object.assign(new Error("Tin tức không tồn tại hoặc đã bị xóa trước đó!"), { statusCode: 404 });
        }

        if (existing.newUrl) {
            await uploadHelper.deleteFile(existing.newUrl, 'medicare');
        }

        return await newsRespository.delete(id);
    }
}