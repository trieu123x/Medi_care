"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Filter, Search, MessageCircle } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { ROUTES } from "@/routers";
import { useChatStore } from "@/stores/chat";
import { SelectBox } from "@/components/ui/SelectBox";
import { SearchInput } from "@/components/ui/SearchInput";

export default function DoctorsPage() {
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const toggleChat = useChatStore(state => state.toggleChat);

  // Lấy danh sách chuyên khoa
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const res = await axiosInstance.get("/specialties");
        if (res.data?.data) {
          setSpecialties(res.data.data);
        } else if (Array.isArray(res.data)) {
          setSpecialties(res.data);
        } else {
          setSpecialties([]);
        }
      } catch (err) {
        console.error("Failed to fetch specialties", err);
      }
    };
    fetchSpecialties();
  }, []);

  // Lấy danh sách bác sĩ dựa vào filter
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        let url = "/doctors";
        const params = new URLSearchParams();

        if (selectedSpecialty && selectedSpecialty !== "" && selectedSpecialty !== "Tất cả chuyên khoa") {
          const spec = specialties.find(s => s.name === selectedSpecialty);
          if (spec) params.append("specialtyId", spec.id);
        }
        if (searchQuery && searchQuery.trim() !== "") {
          params.append("name", searchQuery.trim());
        }
        params.append("limit", "12");
        params.append("page", page.toString());

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const res = await axiosInstance.get(url);
        if (res.success && res.data) {
          setDoctors(res.data);
          setTotalPages(res.pagination?.totalPages || 1);
        } else if (Array.isArray(res)) {
          setDoctors(res);
          setTotalPages(1);
        } else {
          setDoctors([]);
          setTotalPages(1);
        }
      } catch (err) {
        console.error("Failed to fetch doctors", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchDoctors();
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [selectedSpecialty, specialties, searchQuery, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedSpecialty, searchQuery]);

  return (
    <div className="min-h-screen w-full rasa-font py-6 px-4 md:px-8 xl:px-12 max-w-[1536px] mx-auto">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        {/* Bộ lọc chuyên khoa */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="text-black size-5 hidden md:block" />
          <span className="text-black text-[20px] hidden md:inline whitespace-nowrap">Bộ lọc:</span>
          <div className="relative w-fit">
            <SelectBox 
              value={selectedSpecialty || "Tất cả chuyên khoa"} 
              options={["Tất cả chuyên khoa", ...specialties.map(spec => spec.name)]} 
              onChange={(value) => setSelectedSpecialty(value === "Tất cả chuyên khoa" ? "" : value)} 
            />
          </div>
        </div>

        {/* Tìm kiếm */}
        <div className="relative w-full md:w-100 rounded-[12px]">
          <SearchInput className="py-1.5 bg-[#ECECEC]"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Doctor Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : doctors.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-white cursor-pointer rounded-sm shadow-[0_0_4px_rgba(144,144,144,0.25)] overflow-hidden flex flex-col hover:-translate-y-1 transition-all duration-300"
            >
              {/* Doctor Avatar */}
              <div className="relative w-full aspect-88/100 bg-[#f6f7f9]">
                <Image
                  src={doctor.profile?.avatarUrl || "/images/Avartar.jpg"}
                  alt={doctor.profile?.fullName || "Doctor"}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                />
              </div>

              {/* Doctor Info */}
              <div className="px-3 py-2 flex flex-col bg-white text-left h-full gap-1">
                <h3 className="font-bold  text-gray-900 text-[16px] leading-none">
                  {doctor.degree ? `${doctor.degree.name?.normalize('NFC')} - ` : ""} {doctor.profile?.fullName?.normalize('NFC')}
                </h3>

                <p className="text-black text-[13px] line-clamp-2">
                  Chuyên khoa: {doctor.specialty?.name || doctor.specialty || "Đa khoa"}
                </p>

                <div className="mt-auto text-center pt-2">
                  <Link
                    href={`${ROUTES.DOCTORS}/${doctor.id}`}
                    className="text-blue-500 text-[11px] italic hover:text-blue-700 hover:underline underline-offset-2"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 text-gray-500 flex flex-col items-center">
          <Search className="w-10 h-10 text-gray-300 mb-4" />
          <p className="text-base font-medium text-gray-600 mb-1">Không tìm thấy bác sĩ</p>
          <p className="text-sm">Hãy thử tìm với từ khóa hoặc chuyên khoa khác.</p>
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
  );
}
