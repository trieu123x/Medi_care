"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Filter, Search, ChevronRight } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { SelectBox } from "@/components/ui/SelectBox";
import { SearchInput } from "@/components/ui/SearchInput";

export default function MedicineLookupPage() {
  const [medicines, setMedicines] = useState([]);
  const [medicineTypes, setMedicineTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch medicine types on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await axiosInstance.get("/medicine-types/all");
        if (res.success && res.data) {
          setMedicineTypes(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch medicine types", err);
      }
    };
    fetchTypes();
  }, []);

  // Fetch medicines based on filters
  useEffect(() => {
    const fetchMedicines = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedType && selectedType !== "Tất cả loại thuốc") {
          const typeObj = medicineTypes.find(t => t.name === selectedType);
          if (typeObj) params.append("typeId", typeObj.id);
        }
        if (searchQuery) params.append("name", searchQuery);
        params.append("limit", "12");
        params.append("page", page.toString());

        const res = await axiosInstance.get(`/medicines?${params.toString()}`);
        if (res.success) {
          setMedicines(res.data.medicines || []);
          setTotalPages(res.data.pagination?.totalPages || 1);
        }
      } catch (err) {
        console.error("Failed to fetch medicines", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchMedicines, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedType, medicineTypes, searchQuery, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedType, searchQuery]);

  return (
    <div className="min-h-screen w-full rasa-font">
      {/* Top Filter Bar */}
      <div className="bg-white top-15 z-10">
        <div className="max-w-[1536px] mx-auto px-4 md:px-8 xl:px-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <Filter className="text-black size-5 hidden md:block" />
              <span className="text-black text-[20px] hidden md:inline whitespace-nowrap">Bộ lọc:</span>
              <div className="relative w-fit">
                <SelectBox 
                  value={selectedType || "Tất cả loại thuốc"} 
                  options={["Tất cả loại thuốc", ...medicineTypes.map(type => type.name)]} 
                  onChange={(value) => setSelectedType(value === "Tất cả loại thuốc" ? "" : value)} 
                />
              </div>
            </div>
          </div>

          <div className="relative w-full md:w-100 rounded-[12px]">
            <SearchInput className="py-1.5 bg-[#ECECEC]"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Main Content: Medicine Grid */}
      <div className="max-w-[1536px] mx-auto px-4 md:px-8 xl:px-12 py-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 h-64 animate-pulse"></div>
            ))}
          </div>
        ) : medicines.length > 0 ? (
          <div className="cursor-pointer grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {medicines.map((medicine) => (
              <div
                key={medicine.id}
                className="bg-white cursor-pointer rounded-sm shadow-[0_0_4px_rgba(144,144,144,0.25)] overflow-hidden flex flex-col hover:-translate-y-1 transition-all duration-300"
              >
                {/* Medicine Image */}
                <div className="relative w-full aspect-square mb-4 bg-white overflow-hidden rounded-md">
                  <Image
                    src={medicine.imageUrl || "/images/Medicines.webp"}
                    alt={medicine.name}
                    fill
                    className="object-contain p-2 group-hover:scale-105 transition-transform"
                  />
                </div>

                {/* Medicine Info */}
                <div className="px-3 py-2 w-full">
                  <h3 className="text-sm font-bold text-black line-clamp-2">
                    {medicine.name}
                  </h3>
                  <p className="text-black text-[13px]">
                    Loại: {medicine.medicineType?.name || "Chưa xác định"}
                  </p>

                  <Link
                    href={`/medicines/${medicine.id}`}
                    className="text-blue-600 text-[11px] pt-6 italic hover:underline flex items-center justify-center gap-0.5"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Không tìm thấy thuốc nào phù hợp</p>
            <p className="text-sm">Vui lòng thử lại với từ khóa khác hoặc xóa bộ lọc</p>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center mt-10 gap-2 mb-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border cursor-pointer border-gray-200 rounded-md bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-sm font-medium transition-colors duration-200"
            >
              Trước
            </button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 rounded-md border text-sm font-medium transition-colors duration-200 cursor-pointer ${page === i + 1
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border cursor-pointer border-gray-200 rounded-md bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-sm font-medium transition-colors duration-200"
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
