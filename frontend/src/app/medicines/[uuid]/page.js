"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import axiosInstance from "@/utils/axios";

export default function MedicineDetailPage() {
  const { uuid } = useParams();
  const router = useRouter();
  const [medicine, setMedicine] = useState(null);
  const [loading, setLoading] = useState(true);
  console.log(medicine);
  // Fetch medicine details
  useEffect(() => {
    const fetchMedicine = async () => {
      try {
        const res = await axiosInstance.get(`/medicines/${uuid}`);
        if (res.success) {
          setMedicine(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch medicine details", err);
      } finally {
        setLoading(false);
      }
    };
    if (uuid) fetchMedicine();
  }, [uuid]);

  if (loading) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-12 animate-pulse">
          <div className="w-full md:w-1/3 aspect-square bg-gray-100 rounded-lg"></div>
          <div className="flex-1 space-y-6">
            <div className="h-8 bg-gray-100 w-1/2 rounded"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 w-full rounded"></div>
              <div className="h-4 bg-gray-100 w-full rounded"></div>
              <div className="h-4 bg-gray-100 w-3/4 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!medicine) {
    return <div className="text-center py-20 text-gray-500">Không tìm thấy thông tin thuốc</div>;
  }

  // Extract category and specialty
  const categoryNames = medicine.diseases
    ?.map(dm => dm.disease?.category?.name)
    .filter((v, i, a) => v && a.indexOf(v) === i);
  const categoryDisplay = categoryNames?.length > 0 ? categoryNames.join(", ") : "Đang cập nhật";

  const specialtyNames = medicine.diseases
    ?.map(dm => dm.disease?.specialty?.name)
    .filter((v, i, a) => v && a.indexOf(v) === i);
  const specialtyDisplay = specialtyNames?.length > 0 ? specialtyNames.join(", ") : "Đang cập nhật";

  return (
    <div className="bg-white min-h-screen text-black rasa-font">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-[18px]">Quay lại</span>
        </button>

        <div className="flex flex-col md:flex-row gap-12 lg:gap-20">

          {/* Left Column: Image and Metadata */}
          <div className="w-full md:w-fit">
            <div className="sticky top-24">
              <div className="relative w-55 aspect-square overflow-hidden mb-2 flex items-center justify-center">
                <Image
                  src={medicine.imageUrl || "/images/Diseases.jpg"}
                  alt={medicine.name}
                  fill
                  className="object-contain p-4"
                />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 max-w-55 text-[18px]">
                <span>Nhóm bệnh: <strong className="font-bold">{categoryDisplay}</strong></span>

                <span className="">Chuyên khoa: <strong className="font-bold">{specialtyDisplay}</strong></span>

                <span>Loại thuốc: <strong className="font-bold capitalize">{medicine.medicineType?.name || "Xịt"}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold leading-none">
              {medicine.name}
            </h1>

            <div className="h-px w-full bg-[#B1B1B1] my-4"></div>

            <div className="space-y-4">
              {/* Ingredients */}
              <section>
                <h2 className="text-[24px] font-bold leading-none">Thành phần:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  - {medicine.ingredients || "Chưa có thông tin về thành phần."}
                </div>
              </section>

              {/* Dosage */}
              <section>
                <h2 className="text-[24px] font-bold leading-none">Liều lượng khuyên dùng:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  - {medicine.dosage || "Vui lòng xem hướng dẫn của bác sĩ."}
                </div>
              </section>

              {/* Usage Instructions */}
              <section>
                <h2 className="text-[24px] font-bold leading-none">Hướng dẫn sử dụng:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  - {medicine.usageInstruction || "Vui lòng đọc kỹ hướng dẫn sử dụng trước khi dùng."}
                </div>
              </section>

              {/* Side Effects */}
              <section>
                <h2 className="text-[24px] font-bold leading-none">Tác dụng phụ:</h2>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  - {medicine.sideEffects || medicine.side_effects || "Có thể gặp các tác dụng phụ không mong muốn. Vui lòng liên hệ bác sĩ nếu có dấu hiệu bất thường."}
                </div>
              </section>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
