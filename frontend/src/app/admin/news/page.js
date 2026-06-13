"use client"

import { CalendarSelectBox } from "@/components/ui/CalendarSelectBox"
import { LinkButton } from "@/components/ui/LinkButton"
import { SearchInput } from "@/components/ui/SearchInput"
import { Table } from "@/components/ui/Table"
import { Pagination } from "@/components/ui/Pagination"
import { Filter } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { getNewsForAdmin, deleteNews } from "@/routers/news-api"
import { useRouter } from "next/navigation"
import { formatDate } from "@/helper/time-format"
import { format } from "date-fns"

const PAGE_SIZE = 30

const TABLE_COLUMNS = [
  { key: "title", label: "Tiêu đề", width: "30%" },
  { key: "content", label: "Nội dung" },
  { key: "release", label: "Ngày xuất bản", width: "120px" },
  { key: "action", label: "Xóa tin tức", mode: "del", width: "120px" },
]

export default function News() {
  const router = useRouter()

  // UI State
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedDate, setSelectedDate] = useState(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Data State
  const [newsList, setNewsList] = useState([])
  const [loading, setLoading] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page khi filter thay đổi
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedDate])

  const buildParams = useCallback(() => {
    return {
      limit: PAGE_SIZE,
      page: currentPage,
      title: debouncedSearch || undefined,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
    }
  }, [debouncedSearch, selectedDate, currentPage])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = buildParams()
        const res = await getNewsForAdmin(params)
        if (res.data) {
          setNewsList((res.data.items || []).map(n => ({
            ...n,
            release: formatDate(n.createdAt)
          })))
          setTotalCount(res.data.total || 0)
          setTotalPages(res.data.totalPages || 1)
        } else {
          setNewsList([])
        }
      } catch (error) {
        console.error("Lỗi tải danh sách tin tức:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [buildParams])

  const handleDelete = async (row) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tin tức này không?")) return
    try {
      const res = await deleteNews(row.id)
      if (res.success) {
        setNewsList(prev => prev.filter(n => n.id !== row.id))
        setTotalCount(prev => prev - 1)
      }
    } catch (error) {
      console.error("Lỗi xóa tin tức:", error)
      alert("Xóa thất bại!")
    }
  }

  return (
    <div className="grow flex flex-col rasa-font bg-white h-full">
      <div className="flex h-15 px-10 items-end justify-between">
        <div className="flex items-center gap-1">
          <Filter className="w-6 h-6 flex-none" />
          <h1 className="mr-2 text-[20px] flex-none">Bộ lọc:</h1>
          <CalendarSelectBox
            placeholder="Ngày xuất bản"
            value={selectedDate}
            onChange={(date) => {
              setSelectedDate(date)
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <LinkButton href={"/admin/news/detail"} className={`
            bg-[#070575] hover:bg-[#08069b] text-white 
            rounded-[10px] font-light 
          `}>
            Thêm
          </LinkButton>
          <SearchInput
            className="w-95 py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tiêu đề..."
          />
        </div>
      </div>

      <div className="px-10 pt-3 pb-4 flex-1 overflow-hidden flex flex-col">
        <Table
          isLoading={loading}
          columns={TABLE_COLUMNS}
          data={newsList}
          className="max-h-[calc(100vh-300px)]"
          rowClassName="even:bg-white odd:bg-[#F1F4FF]"
          onDelete={handleDelete}
          onRowClick={(row) => router.push(`/admin/news/detail?id=${row.id}`)}
        />

        {/* Footer: tổng số + phân trang */}
        <div className="flex flex-col items-center pt-4 gap-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          <span className="font-bold italic text-[#1100CD] text-[12px]">
            Tổng số {totalCount} tin tức
          </span>
        </div>
      </div>
    </div>
  )
}