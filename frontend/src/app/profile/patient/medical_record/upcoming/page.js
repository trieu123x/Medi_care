"use client";

import { useState, useEffect, useMemo } from "react";
import { Filter } from "lucide-react";
import { UpcomingAppointmentItem } from "../../../../../components/medicalRecord/upcomingItem"; 
import { appointmentApi } from "@/routers/appointment/appointmentRouter";
import { ConfirmModal } from "@/components/ui/Modal"; 
import { useAuthStore } from "@/stores/auth";

export default function UpcomingAppointmentsPage() {
  const { user, isDoctor, isAdmin } = useAuthStore();
  const userId = user?.id; 

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState("newest");

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    appointmentId: null,
    shiftName: "", 
  });

  const fetchUpcomingAppointments = async () => {
    if (!userId || isDoctor || isAdmin) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await appointmentApi.getPatientHistory(userId);
      
      if (res && res.success) {
        const now = new Date();
        const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const upcomingApps = res.data.filter((app) => {
          const isPendingOrConfirmed = app.status === "PENDING" || app.status === "CONFIRMED";
          
          const appDateObj = new Date(app.date);
          const appDateAtMidnight = new Date(appDateObj.getFullYear(), appDateObj.getMonth(), appDateObj.getDate());
          
          const isFutureOrToday = appDateAtMidnight >= todayAtMidnight;

          return isPendingOrConfirmed && isFutureOrToday;
        });

        setAppointments(upcomingApps);
      }
    } catch (error) {
      console.error("Lỗi khi lấy lịch sắp tới:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingAppointments();
  }, [userId, isDoctor, isAdmin]); 

  const requestCancelAppointment = (appointmentId, shiftNum) => {
    setModalConfig({
      isOpen: true,
      appointmentId,
      shiftName: `ca ${shiftNum}`,
    });
  };

  const executeCancelAppointment = async () => {
    const { appointmentId } = modalConfig;
    if (!appointmentId) return;

    try {
      await appointmentApi.cancelAppointment(appointmentId);
      
      alert("Đã hủy lịch khám thành công!");
      
      fetchUpcomingAppointments(); 
      
    } catch (error) {
      console.error("Lỗi hủy lịch:", error);
      alert(error.response?.data?.message || "Đã xảy ra lỗi khi hủy lịch khám.");
    } finally {
      setModalConfig({ isOpen: false, appointmentId: null, shiftName: "" });
    }
  };

  const displayedRecords = useMemo(() => {
    const now = new Date();

    let result = appointments.map((item) => {
      const appDate = new Date(item.date);
      
      const day = String(appDate.getDate()).padStart(2, '0');
      const month = String(appDate.getMonth() + 1).padStart(2, '0');
      const year = appDate.getFullYear();
      const displayDateStr = `${day}/${month}/${year}`;

      const shiftStartHour = 6 + item.shift;
      const shiftEndHour = shiftStartHour + 1;
      
      appDate.setHours(shiftStartHour, 0, 0, 0);

      let timeStatus = "normal";
      const diffHours = (appDate - now) / (1000 * 60 * 60);

      if (now >= appDate && now < new Date(appDate.getTime() + 60 * 60 * 1000)) {
        timeStatus = "ongoing";
      } else if (diffHours > 0 && diffHours <= 24) {
        timeStatus = "urgent";
      }

      return {
        id: item.appointmentId,
        department: item.doctor?.specialityName || "Đa khoa",
        doctor: item.doctor?.name || "Bác sĩ",
        date: displayDateStr, 
        timestamp: appDate.getTime(),
        shiftNum: item.shift, 
        shift: `Ca ${item.shift} (${shiftStartHour}h - ${shiftEndHour}h)`,
        location: "Số 55, Phố Yên Ninh, Phường Ba Đình, Thành phố Hà Nội",
        status: timeStatus,
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
  }, [appointments, filterOption]);

  if (!userId && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FBFBFB] text-gray-500 rasa-font">
        <p className="text-lg italic">Vui lòng đăng nhập để xem danh sách lịch khám sắp tới.</p>
      </div>
    );
  }

  if ((isDoctor || isAdmin) && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FBFBFB] rasa-font">
        <p className="text-red-500 font-bold text-2xl mb-2">Truy cập bị từ chối!</p>
        <p className="text-gray-600 text-lg">Trang quản lý lịch hẹn cá nhân này chỉ dành cho Bệnh nhân.</p>
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
            <option value="oldest">Ngày khám: Cũ xa nhất</option>
            <option value="tai_mui_hong">Chỉ khoa: Tai mũi họng</option>
          </select>
        </div>

        <div className="w-full max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10 text-gray-500 italic rasa-font">
              Đang tải lịch hẹn...
            </div>
          ) : displayedRecords.length > 0 ? (
            displayedRecords.map((record) => (
              <UpcomingAppointmentItem 
                key={record.id} 
                data={record} 
                onCancel={() => requestCancelAppointment(record.id, record.shiftNum)}
              />
            ))
          ) : (
            <div className="text-center py-10 text-gray-500 italic rasa-font">
              Không có lịch hẹn sắp tới nào.
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, appointmentId: null, shiftName: "" })}
        onConfirm={executeCancelAppointment}
        title="Cảnh báo"
        mainMessage={`Bạn có chắc chắn muốn hủy lịch khám bệnh của ${modalConfig.shiftName}?`}
        subMessage="Nếu bạn xác nhận, lịch khám bệnh hiện có cũng sẽ bị hủy theo gây ảnh hưởng đến kế hoạch khám bệnh của bạn."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
      />

    </div>
  );
}