"use client"

import { LinkButton } from "@/components/ui/LinkButton"
import { SearchInput } from "@/components/ui/SearchInput"
import { SelectBox } from "@/components/ui/SelectBox"
import { Table } from "@/components/ui/Table"
import { Pagination } from "@/components/ui/Pagination"
import { Filter } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { getMedicinesForAdmin, deleteMedicine } from "@/routers/medicine-api"
import { getAllMedicineTypes } from "@/routers/medicine-type-api"
import { useRouter } from "next/navigation"

const PAGE_SIZE = 30

const TABLE_COLUMNS = [
  { key: "name", label: "Tên", width: "15%" },
  { key: "medicineTypeName", label: "Loại thuốc", width: "120px" },
  { key: "ingredients", label: "Thành phần" },
  { key: "dosage", label: "Liều lượng" },
  { key: "usageInstruction", label: "Hướng dẫn sử dụng" },
  { key: "sideEffects", label: "Tác dụng phụ" },
  { key: "action", label: "Xóa thuốc", mode: "del", width: "100px" },
]

export default function Medicines() {
  const router = useRouter()

  // UI State
  const [option, setOption] = useState("Tất cả")
  const [medicineTypes, setMedicineTypes] = useState([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Data State
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(false)

  // Load medicine types once
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await getAllMedicineTypes()
        if (res.data) setMedicineTypes(res.data)
      } catch (error) {
        console.error("Lỗi lấy loại thuốc:", error)
      }
    }
    fetchTypes()
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1) // Reset về trang 1 khi search thay đổi
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset trang 1 khi thay đổi filter
  useEffect(() => {
    setCurrentPage(1)
  }, [option])

  const buildParams = useCallback(() => {
    const selectedType = medicineTypes.find(t => t.name === option)
    return {
      limit: PAGE_SIZE,
      page: currentPage,
      typeId: selectedType?.id || undefined,
      name: debouncedSearch || undefined,
    }
  }, [option, debouncedSearch, medicineTypes, currentPage])

  // Fetch data khi params thay đổi
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = buildParams()
        const res = await getMedicinesForAdmin(params)
        if (res.data) {
          const mappedData = (res.data.items || []).map(m => ({
            ...m,
            medicineTypeName: m.medicineType?.name
          }))
          setMedicines(mappedData)
          setTotalCount(res.data.total || 0)
          setTotalPages(res.data.totalPages || 1)
        } else {
          setMedicines([])
        }
      } catch (error) {
        console.error("Lỗi tải danh sách thuốc:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [buildParams])

  const handleDelete = async (row) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa thuốc này không?")) return
    try {
      const res = await deleteMedicine(row.id)
      if (res.success) {
        setMedicines(prev => prev.filter(d => d.id !== row.id))
        setTotalCount(prev => prev - 1)
      }
    } catch (error) {
      console.error("Lỗi xóa thuốc:", error)
      alert("Xóa thất bại!")
    }
  }

  return (
    <div className="grow flex flex-col rasa-font bg-white h-full">
      <div className="flex h-15 px-10 items-end justify-between">
        <div className="flex items-center gap-1">
          <Filter className="w-6 h-6 flex-none" />
          <h1 className="mr-2 text-[20px] flex-none">Bộ lọc:</h1>
          <SelectBox
            placeholder="Loại thuốc"
            value={option}
            onChange={setOption}
            options={["Tất cả", ...medicineTypes.map(t => t.name)]}
          />
        </div>

        <div className="flex items-center gap-2">
          <LinkButton href={"/admin/medicines/detail"} className={`
            bg-[#070575] hover:bg-[#08069b] text-white 
            rounded-[10px] font-light 
          `}>
            Thêm
          </LinkButton>
          <SearchInput
            className="w-95 py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên thuốc..."
          />
        </div>
      </div>

      <div className="px-10 pt-3 pb-4 flex-1 overflow-hidden flex flex-col">
        <Table
          isLoading={loading}
          columns={TABLE_COLUMNS}
          data={medicines}
          className="max-h-[calc(100vh-300px)]"
          rowClassName="even:bg-white odd:bg-[#F1F4FF]"
          onDelete={handleDelete}
          onRowClick={(row) => router.push(`/admin/medicines/detail?id=${row.id}`)}
        />

        {/* Footer: tổng số + phân trang */}
        <div className="flex items-center justify-between pt-4">
          <span className="font-bold italic text-[#1100CD] text-[12px]">
            Tổng số {totalCount} thuốc
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  )
}