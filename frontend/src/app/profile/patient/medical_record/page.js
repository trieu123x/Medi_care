"use client";

import { useState, useEffect, useMemo } from "react";
import { Filter } from "lucide-react";
import { MedicalRecordItem } from "../../../../components/medicalRecord/medicalRecordItem";
import { appointmentApi } from "@/routers/appointment/appointmentRouter";
import { useAuthStore } from "@/stores/auth";

export default function MedicalHistoryPage() {
  const { user, isDoctor, isAdmin } = useAuthStore();
  const userId = user?.id; 

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState("newest");

  const fetchMedicalHistory = async () => {
    if (!userId || isDoctor || isAdmin) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await appointmentApi.getPatientHistory(userId);
      
      if (res && res.success) {
        const completedApps = res.data.filter(
          (app) => app.status === "COMPLETED"
        );

        setRecords(completedApps);
      }
    } catch (error) {
      console.error("Lỗi khi lấy lịch sử khám:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicalHistory();
  }, [userId, isDoctor, isAdmin]); 

  const displayedRecords = useMemo(() => {
    let result = records.map((item) => {
      const appDate = new Date(item.date);
      
      const shiftStartHour = 6 + item.shift;
      const shiftEndHour = shiftStartHour + 1;

      const medicalRecordInfo = item.medicalRecord || {};

      return {
        id: item.appointmentId,
        patientName: item.patient?.fullName || "Bệnh nhân", 
        phone: item.patient?.phone || "---",
        doctor: item.doctor?.name || "Bác sĩ", 
        department: item.doctor?.specialityName || "Đa khoa",
        date: appDate.toLocaleDateString("vi-VN"),
        timestamp: appDate.getTime(),
        shift: `Ca ${item.shift} (${shiftStartHour}h - ${shiftEndHour}h)`,
        location: "Số 55, Phố Yên Ninh, Phường Ba Đình, Thành phố Hà Nội",
        
        diagnosis: item.diagnosis || medicalRecordInfo.diagnosis || "Chưa có kết luận",
        prescription: medicalRecordInfo.prescription || "Không có", 
        note: medicalRecordInfo.note || "Không có",                
        symptoms: item.symptoms || item.reason || "Không có triệu chứng", 
      };
    });

    if (filterOption === "newest") {
      result.sort((a, b) => b.timestamp - a.timestamp);
    } else if (filterOption === "oldest") {
      result.sort((a, b) => a.timestamp - b.timestamp);
    } else if (filterOption === "tai_mui_hong") {
      result = result.filter(record => record.department === "Tai mũi họng");
    }

    return result;
  }, [records, filterOption]);

  if (!userId && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FBFBFB] text-gray-500 rasa-font">
        <p className="text-lg italic">Vui lòng đăng nhập để xem lịch sử khám bệnh của bạn.</p>
      </div>
    );
  }

  if ((isDoctor || isAdmin) && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FBFBFB] rasa-font">
        <p className="text-red-500 font-bold text-2xl mb-2">Truy cập bị từ chối!</p>
        <p className="text-gray-600 text-lg">Trang lịch sử khám bệnh này chỉ dành cho Bệnh nhân.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#FBFBFB] p-6 lg:p-10 min-h-screen flex justify-center">
      <div className="w-full max-w-[1400px]">
        
        <div className="flex items-center gap-3 mb-6 rasa-font text-[20px]">
          <Filter className="w-5 h-5 text-gray-700" />
          <span className="font-bold">Bộ lọc:</span>
          
          <select 
            className="border border-gray-300 bg-white px-3 py-1.5 rounded-md text-[15px] outline-none cursor-pointer focus:border-blue-500"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
          >
            <option value="newest">Ngày khám: Gần đây nhất</option>
            <option value="oldest">Ngày khám: Cũ nhất</option>
            <option value="tai_mui_hong">Chỉ khoa: Tai mũi họng</option>
          </select>
        </div>

        <div className="w-full max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10 text-gray-500 italic rasa-font">
              Đang tải hồ sơ...
            </div>
          ) : displayedRecords.length > 0 ? (
            displayedRecords.map((record) => (
              <MedicalRecordItem key={record.id} data={record} />
            ))
          ) : (
            <div className="text-center py-10 text-gray-500 italic rasa-font">
              Không tìm thấy hồ sơ khám bệnh nào đã hoàn thành.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}