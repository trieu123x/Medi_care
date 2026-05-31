"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Phone, Award, GraduationCap, Briefcase, ChevronLeft, Calendar } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { Button } from "@/components/ui/Button";

export default function DoctorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid;

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/doctors/${uuid}`);
        if (res.success) {
          setDoctor(res.data);
        } else {
          setError("Không tìm thấy thông tin bác sĩ");
        }
      } catch (err) {
        console.error("Failed to fetch doctor detail", err);
        setError("Đã xảy ra lỗi khi tải thông tin bác sĩ");
      } finally {
        setLoading(false);
      }
    };

    if (uuid) {
      fetchDoctor();
    }
  }, [uuid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{error || "Không tìm thấy bác sĩ"}</h2>
        <Link href="/doctors" className="text-blue-600 hover:underline flex items-center">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>
    );
  }

  const { profile, specialty, degree, experience, education, achievements } = doctor;

  const handleBookingClick = () => {
    const searchParams = new URLSearchParams();
    searchParams.set("doctorId", uuid);
    if (specialty?.id) searchParams.set("specialtyId", specialty.id);

    router.push(`/appointment?${searchParams.toString()}`);
  };

  return (
    <div className="bg-white pb-12 rasa-font">
      <div className="px-6 sm:px-8 lg:px-12 pt-8">

        <div className="flex flex-col lg:flex-row gap-16 grow">
          {/* Left Column: Profile Card */}
          <div className="relative flex flex-col items-center min-w-55 h-full">
            <div className="w-full sticky top-24">
              <div className="relative w-full h-63 mb-2">
                <Image
                  src={profile?.avatarUrl || "/images/Avartar.jpg"}
                  alt={profile?.fullName || "Doctor"}
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 max-w-55 text-[18px]">
                <span>Chuyên khoa: <strong className="font-bold">{specialty?.name || "Đa khoa"}</strong></span>

                <span className="">Bằng cấp: <strong className="font-bold">{degree?.name || "Bác sĩ"}</strong></span>

                <span>Loại thuốc: <strong className="font-bold capitalize">{profile?.phone || "0123456789"}</strong></span>
              </div>
            </div>

            <Button onClick={handleBookingClick} className=" mt-4 bg-[#0a008c] hover:bg-blue-900 text-white px-6 py-1.5">
              Đặt lịch khám ngay!
            </Button>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="w-full">
            <header className="">
              <h1 className="text-[30px] font-extrabold leading-none">
                {degree ? `${degree.name} - ` : ""} {profile?.fullName}
              </h1>
            </header>

            <div className="h-px w-full bg-[#B1B1B1] my-4"></div>

            <div className="space-y-4">
              {/* Experience Section */}
              <section className="relative">
                <div className="flex items-center leading-none">
                  <h2 className="text-[24px] font-bold">Kinh nghiệm làm việc:</h2>
                </div>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {experience || "Thông tin kinh nghiệm đang được cập nhật."}
                </div>
              </section>

              {/* Education Section */}
              <section className="relative">
                <div className="flex items-center leading-none">
                  <h2 className="text-[24px] font-bold">Trình độ học vấn:</h2>
                </div>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {education || "Thông tin học vấn đang được cập nhật."}
                </div>
              </section>

              {/* Achievements Section */}
              <section className="relative">
                <div className="flex items-center leading-none">
                  <h2 className="text-[24px] font-bold">Thành tựu:</h2>
                </div>
                <div className="text-[22px] leading-relaxed whitespace-pre-line">
                  {achievements || "Thông tin thành tựu đang được cập nhật."}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
