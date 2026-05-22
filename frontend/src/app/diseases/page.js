"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Filter, Search, ChevronRight } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { SelectBox } from "@/components/ui/SelectBox";
import { SearchInput } from "@/components/ui/SearchInput";

export default function DiseaseLookupPage() {
  const [diseases, setDiseases] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch filters data
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [specRes, catRes] = await Promise.all([
          axiosInstance.get("/specialties"),
          axiosInstance.get("/disease-catgorize/all"),
        ]);

        console.log("Specialties result:", specRes);
        console.log("Categories result:", catRes);

        if (specRes.success && specRes.data) {
          setSpecialties(Array.isArray(specRes.data) ? specRes.data : []);
        } else if (Array.isArray(specRes)) {
          setSpecialties(specRes);
        }

        if (catRes.success && catRes.data) {
          setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        } else if (Array.isArray(catRes)) {
          setCategories(catRes);
        }
      } catch (err) {
        console.error("Failed to fetch filters", err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch diseases based on filters
  useEffect(() => {
    const fetchDiseases = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        
        if (selectedSpecialty && selectedSpecialty !== "Tất cả chuyên khoa") {
          const spec = specialties.find(s => s.name === selectedSpecialty);
          if (spec) params.append("specialtyId", spec.id);
        }
        
        if (selectedCategory && selectedCategory !== "Tất cả nhóm bệnh") {
          const cat = categories.find(c => c.name === selectedCategory);
          if (cat) params.append("categoryId", cat.id);
        }
        
        if (searchQuery) params.append("name", searchQuery);
        params.append("page", page.toString());

        const res = await axiosInstance.get(`/disease?${params.toString()}`);
        if (res.success) {
          if (res.data.items) {
            setDiseases(res.data.items);
            setTotalPages(res.data.pagination?.totalPages || 1);
          } else {
            setDiseases(res.data);
            setTotalPages(1);
          }
        }
      } catch (err) {
        console.error("Failed to fetch diseases", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchDiseases, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedSpecialty, selectedCategory, searchQuery, page]);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedSpecialty, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen w-full rasa-font">
      {/* Top Filter Bar */}
      <div className="bg-white top-15 z-10">
        <div className="max-w-[1536px] mx-auto px-4 md:px-8 xl:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <Filter className="text-black size-5 hidden md:block" />
              <span className="text-black text-[20px] hidden md:inline whitespace-nowrap">Bộ lọc:</span>
              <SelectBox 
                value={selectedSpecialty || "Tất cả chuyên khoa"} 
                options={["Tất cả chuyên khoa", ...specialties.map(s => s.name)]} 
                onChange={(value) => setSelectedSpecialty(value === "Tất cả chuyên khoa" ? "" : value)} 
              />
              <SelectBox 
                value={selectedCategory || "Tất cả nhóm bệnh"} 
                options={["Tất cả nhóm bệnh", ...categories.map(c => c.name)]} 
                onChange={(value) => setSelectedCategory(value === "Tất cả nhóm bệnh" ? "" : value)} 
              />
            </div>
          </div>

          <div className="relative w-full md:w-100 rounded-[12px]">
            <SearchInput className="py-1.5 bg-[#ECECEC]"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Main Content: Disease Grid */}
      <div className="max-w-[1536px] mx-auto px-4 md:px-8 xl:px-12 py-2">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 h-40 animate-pulse"></div>
            ))}
          </div>
        ) : diseases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
            {diseases.map((disease) => (
              <div
                key={disease.id}
                className="bg-white cursor-pointer h-38 rounded-md overflow-hidden shadow-[0_0_4px_rgba(144,144,144,0.25)] flex hover:-translate-y-1 transition-all duration-300"
              >
                {/* Disease Image */}
                <div className="relative w-1/3 min-w-[120px] h-full bg-gray-50">
                  <Image
                    src={disease.imageUrl || "/images/Diseases.jpg"}
                    alt={disease.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Disease Info */}
                <div className="flex-1 py-2 pl-2 pr-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-[20px] font-bold text-black line-clamp-1">
                      {disease.name}
                    </h3>
                    <p className="text-black text-sm line-clamp-3">
                      {disease.description || "Thông tin về bệnh đang được cập nhật. Vui lòng quay lại sau."}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/diseases/${disease.id}`}
                      className="text-blue-600 text-xs font-medium hover:underline flex items-center gap-0.5 italic"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Không tìm thấy bệnh nào phù hợp</p>
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
