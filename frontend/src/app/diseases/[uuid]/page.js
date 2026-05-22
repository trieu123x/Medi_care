"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Stethoscope, Pill as PillIcon, ArrowLeft } from "lucide-react";
import axiosInstance from "@/utils/axios";

export default function DiseaseDetailPage() {
  const { uuid } = useParams();
  const router = useRouter();
  const [disease, setDisease] = useState(null);
  const [loading, setLoading] = useState(true);

  // State for "Show All" toggles
  const [showAllMedicines, setShowAllMedicines] = useState(false);
  const [showAllDoctors, setShowAllDoctors] = useState(false);

  useEffect(() => {
    const fetchDisease = async () => {
      try {
        const res = await axiosInstance.get(`/disease/${uuid}`);
        if (res.success) {
          setDisease(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch disease details", err);
      } finally {
        setLoading(false);
      }
    };
    if (uuid) fetchDisease();
  }, [uuid]);
  console.log(disease)
  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 animate-pulse">
        <div className="flex flex-col md:flex-row gap-12 mb-16">
          <div className="w-full md:w-1/4 aspect-square bg-gray-100 rounded-lg"></div>
          <div className="flex-1 space-y-6">
            <div className="h-10 bg-gray-100 w-1/3 rounded"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-100 w-full rounded"></div>
              <div className="h-4 bg-gray-100 w-full rounded"></div>
              <div className="h-4 bg-gray-100 w-2/3 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!disease) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Stethoscope className="w-16 h-16  opacity-20" />
        <p className="text-lg font-medium">Không tìm thấy thông tin bệnh</p>
      </div>
    );
  }

  const medicines = disease.medicines?.map(m => m.medicine) || [];
  const doctors = disease.specialty?.doctors || [];

  const displayedMedicines = showAllMedicines ? medicines : medicines.slice(0, 6);
  const displayedDoctors = showAllDoctors ? doctors : doctors.slice(0, 6);

  return (
    <div className="bg-white min-h-screen rasa-font">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-[18px]">Quay lại</span>
        </button>

        {/* Top Section: Disease Info */}
        <div className="flex flex-col md:flex-row mb-10 md:gap-12">
          {/* Left: Image and Meta */}
          <div className="w-full md:w-fit">
            <div className="sticky top-24">
              <div className="w-50 h-50 overflow-hidden mb-2">
                <Image
                  src={disease.imageUrl || "/images/Diseases.jpg"}
                  alt={disease.name}
                  width={200} height={200}
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="text-black text-sm">
                <div className="flex gap-1 items-center">
                  <span className="text-[18px]">Chuyên khoa:</span>
                  <span className="text-[18px] font-bold">{disease.specialty?.name || "Đang cập nhật"}</span>
                </div>
                <div className="flex gap-1 items-center">
                  <span className="text-[18px]">Nhóm bệnh:</span>
                  <span className="text-[18px] font-bold">{disease.category?.name || "Mãn tính"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="flex-1">
            <h1 className="text-[30px] font-bold leading-none">
              {disease.name}
            </h1>

            <div className="h-px w-full bg-[#B1B1B1] my-3"></div>

            <div className="space-y-4">
              <section>
                <h2 className="text-[24px] leading-none font-bold ">Mô tả bệnh:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {disease.description || "Chưa có mô tả chi tiết cho bệnh này."}
                </div>
              </section>

              <section>
                <h2 className="text-[24px] leading-none font-bold ">Triệu chứng:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {disease.symptoms || "Chưa có thông tin về triệu chứng."}
                </div>
              </section>

              <section>
                <h2 className="text-[24px] leading-none font-bold ">Xử lý tại nhà:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {disease.homeTreatment || "Vui lòng liên hệ bác sĩ để được tư vấn chính xác nhất."}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-[#B1B1B1] my-4"></div>

        {/* Suggested Medicines Section */}
        <div className="mb-10">
          <div className="flex items-center mb-1">
            <h2 className="text-[30px] font-bold">Thuốc điều trị gợi ý</h2>
          </div>

          {medicines.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {displayedMedicines.map((med) => (
                  <div key={med.id} className="w-55 cursor-pointer bg-white shadow-[0_0_4px_rgba(144,144,144,0.25)] hover:-translate-y-1 transition-all group">
                    <div className="relative w-full aspect-square mb-4 bg-gray-50 rounded overflow-hidden">
                      <Image
                        src={med.imageUrl || "/images/Diseases.jpg"}
                        alt={med.name}
                        fill
                        className="object-contain transition-transform"
                      />
                    </div>
                    <h3 className="font-bold line-clamp-2 leading-none px-2">{med.name}</h3>
                    <p className="text-[13px] mb-3 tracking-tighter px-2">Loại: {med.medicineType || "uống"}</p>
                    <Link href={`/medicines/${med.id}`} className="text-[12px] text-blue-600 hover:underline block text-center border-t italic border-gray-50 py-2">
                      Xem chi tiết
                    </Link>
                  </div>
                ))}
              </div>
              {medicines.length > 6 && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setShowAllMedicines(!showAllMedicines)}
                    className="text-blue-600 font-medium hover:underline flex items-center gap-1 mx-auto text-sm"
                  >
                    {showAllMedicines ? "Thu gọn" : "Xem tất cả"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">Chưa có gợi ý thuốc cho bệnh này.</p>
          )}
        </div>

        <div className="h-px w-full bg-[#B1B1B1] my-4"></div>

        {/* Suggested Doctors Section */}
        <div className="">
          <div className="flex items-center mb-1">
            <h2 className="text-[30px] font-bold">Bác sĩ điều trị gợi ý</h2>
          </div>

          {doctors.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {displayedDoctors.map((doc) => (
                  <div key={doc.id} className="w-55 cursor-pointer bg-white shadow-sm hover:shadow-md transition-all">
                    <div className="relative w-full h-63 mb-3 overflow-hidden">
                      <Image
                        src={doc.profile?.avatarUrl || "/images/Avartar.jpg"}
                        alt={doc.profile?.fullName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h3 className="font-bold line-clamp-2 leading-none px-2">{doc.degree} - {doc.profile?.fullName}</h3>
                    <p className="text-[13px] mb-3 tracking-tighter px-2">
                      Chuyên khoa: {disease.specialty?.name || "Đang cập nhật"}
                    </p>
                    <Link href={`/doctors/${doc.id}`} className="text-[12px] text-center text-blue-600 hover:underline block border-t border-gray-50 py-2 italic">
                      Xem chi tiết
                    </Link>
                  </div>
                ))}
              </div>
              {doctors.length > 6 && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setShowAllDoctors(!showAllDoctors)}
                    className="text-blue-600 font-medium hover:underline flex items-center gap-1 mx-auto text-sm"
                  >
                    {showAllDoctors ? "Thu gọn" : "Xem tất cả"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">Chưa có gợi ý bác sĩ cho chuyên khoa này.</p>
          )}
        </div>
      </div>


    </div>
  );
}
