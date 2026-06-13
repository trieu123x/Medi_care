"use client";

import { useState, useEffect } from "react";
import { Newsitem } from "@/components/news/newsItem";
import { newsApi } from "@/routers/news/newsRouter";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export default function NewsPage() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search + reset trang
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTitle);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTitle]);

  // Fetch khi page hoặc search thay đổi
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError("");
      try {
        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
          ...(debouncedSearch.trim() ? { title: debouncedSearch.trim() } : {}),
        };

        const result = await newsApi.getNewsList(params);

        if (result && result.success) {
          setNewsList(result.data?.items || []);
          setTotalPages(result.data?.totalPages || 1);
          setTotalCount(result.data?.total || 0);
        } else {
          setError(result?.message || "Lỗi khi lấy dữ liệu từ máy chủ.");
        }
      } catch (err) {
        console.error("Lỗi khi gọi API:", err);
        setError("Không thể tải danh sách tin tức lúc này.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [currentPage, debouncedSearch]);

  return (
    <div className="w-full min-h-screen bg-[#FBFBFB] py-8 rasa-font">
      <div className="w-full mx-auto px-10">

        {/* Search bar */}
        <div className="flex w-full justify-end mb-5 rasa-font">
          <SearchInput
            className="w-[400px] py-1.5 bg-[#ECECEC]"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="Tìm kiếm tin tức..."
          />
        </div>

        {/* Content area */}
        {loading ? (
          // Skeleton loading
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
                <div className="w-full h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : newsList.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {debouncedSearch
              ? `Không tìm thấy tin tức nào phù hợp với "${debouncedSearch}".`
              : "Chưa có tin tức nào."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {newsList.map((item) => (
              <Newsitem key={item.id} data={item} />
            ))}
          </div>
        )}

        {/* Pagination footer */}
        {!loading && !error && (
          <div className="flex flex-col items-center mt-8 pb-8 gap-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            <span className="text-[13px] text-gray-500 italic">
              Tổng số <span className="font-semibold text-[#4066FF]">{totalCount}</span> tin tức
            </span>
          </div>
        )}

      </div>
    </div>
  );
}