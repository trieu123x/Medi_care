"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import FilterImage from "@/public/images/Filter.svg"; 
import { DoctorAppointmentItem } from "@/components/medicalRecord/doctor/doctorAppointmentItem";
import { appointmentApi } from "@/routers/appointment/appointmentRouter"; 
import { ConfirmModal } from "@/components/ui/Modal"; 
import { useAuthStore } from "@/stores/auth"; 

export default function DoctorRecordNotDonePage() {
  const { user, isDoctor } = useAuthStore();
  const doctorId = user?.id; 

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState("newest");

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    appointmentId: null,
    medicalRecordData: null,
    patientName: "", 
  });

  const fetchAppointments = async () => {
    if (!doctorId || !isDoctor) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const res = await appointmentApi.getDoctorSchedule(doctorId);
      
      if (res && res.success) {
        const upcomingApps = res.data.filter(app => 
          app.status === "CONFIRMED"
        );
        setAppointments(upcomingApps);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch khám:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [doctorId, isDoctor]); 

  const requestCompleteAppointment = (appointmentId, medicalRecordData, patientName) => {
    setModalConfig({
      isOpen: true,
      appointmentId,
      medicalRecordData,
      patientName: patientName || "Bệnh nhân", 
    });
  };

  const executeCompleteAppointment = async () => {
    const { appointmentId, medicalRecordData } = modalConfig;
    if (!appointmentId) return;

    try {
      await appointmentApi.createMedicalRecord(appointmentId, medicalRecordData);
      
      alert("Đã lưu bệnh án và hoàn tất ca khám!");
      
      fetchAppointments(); 
      
    } catch (error) {
      console.error("Lỗi khi tạo bệnh án:", error);
      alert("Đã xảy ra lỗi khi hoàn tất ca khám.");
    } finally {
      setModalConfig({ isOpen: false, appointmentId: null, medicalRecordData: null, patientName: "" });
    }
  };

  const handleCancelAppointment = async (appointmentId, patientName) => {
    const confirmMsg = `Bạn có chắc chắn muốn HỦY lịch khám của bệnh nhân ${patientName}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await appointmentApi.updateAppointmentStatus(appointmentId, { status: "CANCELLED" });
      setAppointments(prev => prev.filter(app => app.appointmentId !== appointmentId));
      alert("Đã hủy lịch khám thành công!");
    } catch (error) {
      console.error("Lỗi khi hủy lịch:", error);
      const errorMessage = error.response?.data?.message || "Có lỗi xảy ra khi hủy lịch khám!";
      alert(`Hủy thất bại: ${errorMessage}`);
    }
  };

  const displayedRecords = useMemo(() => {
    const now = new Date();

    let result = appointments.map((app) => {
      const appDate = new Date(app.date);
      
      const shiftStartHour = 6 + app.shift; 
      appDate.setHours(shiftStartHour, 0, 0, 0);

      const diffInHours = (appDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      // canCancel: còn hơn 24h mới đến ca khám
      const canCancel = diffInHours > 24;

      let timeStatus = "normal";
      
      if (now >= appDate) {
        timeStatus = "ongoing"; 
      }

      return {
        id: app.appointmentId,
        department: "Đa khoa", 
        patientName: app.patient?.name || "Bệnh nhân ẩn danh",
        phone: app.patient?.phone || "---",
        date: appDate.toLocaleDateString('vi-VN'),
        timestamp: appDate.getTime(),
        shift: `Ca ${app.shift} (${shiftStartHour}h - ${shiftStartHour + 1}h)`,
        status: timeStatus, 
        diagnosisMsg: app.reason || "Bệnh nhân chưa nhập lý do khám",
        canCancel,
      };
    });

    if (filterOption === "newest") {
      result.sort((a, b) => b.timestamp - a.timestamp); 
    } else if (filterOption === "oldest") {
      result.sort((a, b) => a.timestamp - b.timestamp); 
    }

    return result;
  }, [appointments, filterOption]);

  if (!doctorId && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FBFBFB] text-gray-500 rasa-font">
        <p className="text-lg italic">Vui lòng đăng nhập với tài khoản bác sĩ để xem danh sách lịch khám.</p>
      </div>
    );
  }

  if (!isDoctor && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FBFBFB] rasa-font">
        <p className="text-red-500 font-bold text-2xl mb-2">Truy cập bị từ chối!</p>
        <p className="text-gray-600 text-lg">Trang quản lý ca khám này chỉ dành riêng cho Bác sĩ.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#FBFBFB] p-6 lg:p-10 min-h-screen flex justify-center">
      <div className="w-full max-w-[1400px]">
        
        <div className="flex items-center gap-3 mb-6 rasa-font text-[20px]">
          <Image src={FilterImage} alt="Filter" height={20} width={20} />
          <span className="font-bold">Bộ lọc:</span>
          
          <select 
            className="border border-gray-300 bg-white px-3 py-1.5 rounded-md text-[15px] outline-none cursor-pointer focus:border-blue-500"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
          >
            <option value="newest">Ngày khám: Gần đây nhất</option>
            <option value="oldest">Ngày khám: Cũ nhất</option>
          </select>
        </div>

        <div className="w-full max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
             <div className="text-center py-10 text-gray-500 italic rasa-font">Đang tải lịch khám...</div>
          ) : displayedRecords.length > 0 ? (
            displayedRecords.map((record) => (
              <DoctorAppointmentItem 
                key={record.id} 
                data={record} 
                onCompleteAppointment={(appId, medData) => requestCompleteAppointment(appId, medData, record.patientName)} 
                onCancelAppointment={handleCancelAppointment}
              />
            ))
          ) : (
            <div className="text-center py-10 text-gray-500 italic rasa-font">
              Không có lịch khám nào sắp tới.
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, appointmentId: null, medicalRecordData: null, patientName: "" })}
        onConfirm={executeCompleteAppointment}
        title="Xác nhận"
        mainMessage={`Bạn có chắc chắn xác nhận hoàn tất cho ${modalConfig.patientName}?`}
        subMessage="Nếu bạn xác nhận, ca khám này sẽ được đánh dấu là đã hoàn tất và kết quả bệnh án sẽ được lưu lại."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
      />

    </div>
  );
}