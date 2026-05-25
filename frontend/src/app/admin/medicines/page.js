"use client"

import { LinkButton } from "@/components/ui/LinkButton"
import { SearchInput } from "@/components/ui/SearchInput"
import { SelectBox } from "@/components/ui/SelectBox"
import { Table } from "@/components/ui/Table"
import { Filter } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { getMedicinesForAdmin, deleteMedicine, getTotalMedicines } from "@/routers/medicine-api"
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
  const [medicineTypes, setMedicineTypes] = useState([]) // Dữ liệu types thật
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Data State
  const [medicines, setMedicines] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  // Refs
  const tableRef = useRef(null)
  const isFetching = useRef(false)

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [countRes, typesRes] = await Promise.all([
          getTotalMedicines(),
          getAllMedicineTypes()
        ])
        if (countRes.data) setTotalCount(countRes.data.total)
        if (typesRes.data) setMedicineTypes(typesRes.data)
      } catch (error) {
        console.error("Lỗi lấy dữ liệu khởi tạo:", error)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const buildParams = useCallback((lastId = undefined) => {
    const selectedType = medicineTypes.find(t => t.name === option)

    return {
      limit: PAGE_SIZE,
      typeId: selectedType?.id || undefined,
      name: debouncedSearch || undefined,
      lastId: lastId
    }
  }, [option, debouncedSearch, medicineTypes])

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      isFetching.current = true

      try {
        const params = buildParams()
        const res = await getMedicinesForAdmin(params)

        if (res.data) {
          const mappedData = res.data.map(m => ({ ...m, medicineTypeName: m.medicineType?.name }))
          setMedicines(mappedData)
          setHasMore(res.data.length >= PAGE_SIZE)
        } else {
          setMedicines([])
        }
      } catch (error) {
        console.error("Lỗi tải danh sách thuốc:", error)
      } finally {
        setLoading(false)
        isFetching.current = false
      }
    }

    fetchInitialData()
  }, [buildParams])

  const loadMore = useCallback(async () => {
    if (isFetching.current || !hasMore || medicines.length === 0) return

    const lastId = medicines[medicines.length - 1].id

    isFetching.current = true
    setLoading(true)

    try {
      const params = buildParams(lastId)
      const res = await getMedicinesForAdmin(params)

      if (res.data) {
        const mappedData = res.data.map(m => ({ ...m, medicineTypeName: m.medicineType?.name }))
        setMedicines(prev => {
          const combined = [...prev, ...mappedData]
          return Array.from(new Map(combined.map(item => [item.id, item])).values())
        })
        setHasMore(res.data.length >= PAGE_SIZE)
      }
    } catch (error) {
      console.error("Lỗi tải thêm thuốc:", error)
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [hasMore, medicines, buildParams])

  useEffect(() => {
    const tableEl = tableRef.current
    if (!tableEl) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = tableEl
      if (scrollTop + clientHeight >= scrollHeight - 50 && hasMore && !isFetching.current) {
        loadMore()
      }
    }

    tableEl.addEventListener("scroll", handleScroll)
    return () => tableEl.removeEventListener("scroll", handleScroll)
  }, [loadMore, hasMore])

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

      <div className="px-10 pt-3 pb-4 flex-1 overflow-hidden">
        <Table
          ref={tableRef}
          isLoading={loading}
          columns={TABLE_COLUMNS}
          data={medicines}
          className="max-h-[calc(100vh-250px)]"
          rowClassName="even:bg-white odd:bg-[#F1F4FF]"
          onDelete={handleDelete}
          onRowClick={(row) => router.push(`/admin/medicines/detail?id=${row.id}`)}
        />
        <div className="flex pt-4">
          <span className="font-bold italic text-[#1100CD] text-xl">
            Tổng số {totalCount}
          </span>
        </div>
      </div>
    </div>
  )
}