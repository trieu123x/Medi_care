"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { appointmentApi } from "@/routers/appointment/appointmentRouter"; 
import { specialtyApi } from "@/routers/speciality/specialityRouter"; 
import { ROUTES } from "@/routers";

export function BookingForm({ patientId, onConfirm, onChangeData }) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSpecialtyId = searchParams.get("specialtyId");
  const urlDoctorId = searchParams.get("doctorId");

  const [formData, setFormData] = useState({
    specialtyId: urlSpecialtyId || "",   
    specialtyName: "", 
    doctorId: urlDoctorId || "",      
    doctorName: "",    
    date: "",
    shift: "",
    reason: "" 
  });
  
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  const [availableShifts, setAvailableShifts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [fetchingSpecs, setFetchingSpecs] = useState(true);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [fetchingShifts, setFetchingShifts] = useState(false); 

  useEffect(() => {
    if (onChangeData) onChangeData(formData);
  }, [formData, onChangeData]);

  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const res = await specialtyApi.getAllSpecialties();
        if (res && res.success) {
          setSpecialties(res.data);
          
          if (urlSpecialtyId) {
            const found = res.data.find(s => s.id === urlSpecialtyId);
            if (found) {
              setFormData(prev => ({ ...prev, specialtyName: found.name }));
            }
          }
        }
      } catch (error) {
        console.error("Lỗi tải khoa:", error);
      } finally {
        setFetchingSpecs(false);
      }
    };
    fetchSpecialties();
  }, [urlSpecialtyId]);

  useEffect(() => {
    if (urlDoctorId && doctors.length > 0) {
      const found = doctors.find(d => d.id === urlDoctorId);
      if (found) {
        setFormData(prev => ({
          ...prev,
          doctorName: `${found.degree ? `${found.degree} - ` : ""}${found.profile?.fullName}`
        }));
      }
    }
  }, [urlDoctorId, doctors]);

  useEffect(() => {
    if (!formData.specialtyId) {
      setDoctors([]);
      return;
    }
    const fetchDoctors = async () => {
      setFetchingDocs(true);
      try {
        const res = await specialtyApi.getDoctorsBySpecialty(formData.specialtyId);
        if (res && res.success) setDoctors(res.data);
      } catch (error) {
        console.error("Lỗi tải bác sĩ:", error);
      } finally {
        setFetchingDocs(false);
      }
    };
    fetchDoctors();
  }, [formData.specialtyId]);

  useEffect(() => {
    if (!formData.doctorId || !formData.date) {
      setAvailableShifts([]);
      setFormData(prev => ({ ...prev, shift: "" })); 
      return;
    }

    const fetchAvailableShifts = async () => {
      setFetchingShifts(true);
      try {
        const res = await appointmentApi.getAvailableSlots({
          doctorId: formData.doctorId,
          date: formData.date,
          patientId: patientId 
        });
        
        if (res && res.success) {
          setAvailableShifts(res.data);
        } else {
          setAvailableShifts([]);
        }
      } catch (error) {
        console.error("Lỗi tải ca khám trống:", error);
        setAvailableShifts([]);
      } finally {
        setFetchingShifts(false);
      }
    };

    fetchAvailableShifts();
  }, [formData.doctorId, formData.date, patientId]); 

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSpecialtyChange = (e) => {
    const selectedId = e.target.value;
    const selectedSpec = specialties.find(s => s.id === selectedId || s._id === selectedId); 
    setFormData(prev => ({
      ...prev,
      specialtyId: selectedId,
      specialtyName: selectedSpec ? selectedSpec.name : "",
      doctorId: "",   
      doctorName: "",
      shift: "" 
    }));
  };

  const handleDoctorChange = (e) => {
    const selectedId = e.target.value;
    const selectedDoc = doctors.find(d => d.id === selectedId || d._id === selectedId);
    setFormData(prev => ({
      ...prev,
      doctorId: selectedId,
      doctorName: selectedDoc ? `${selectedDoc.degree ? `${selectedDoc.degree} - ` : ""}${selectedDoc.profile?.fullName}` : "",
      shift: "" 
    }));
  };

  const handleSubmit = async () => {
    if (!formData.doctorId || !formData.date || !formData.shift || !formData.reason) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        doctorId: formData.doctorId, 
        date: formData.date,
        shift: parseInt(formData.shift),
        reason: formData.reason
      };
      console.log("payload", payload);

      const res = await appointmentApi.bookAppointment(payload);
      
      if (res && res.success) {
        alert("Đặt lịch khám thành công!");
        onConfirm(); 
        router.push(ROUTES.MEDICAL_RECORD_UPCOMING);
      } else {
        alert(res.message || "Đặt lịch thất bại, vui lòng thử lại.");
      }
    } catch (error) {
      alert("Đã có lỗi xảy ra từ máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const formatShiftTime = (shiftNum) => {
    const startHour = 6 + parseInt(shiftNum);
    return `Ca ${shiftNum} (${startHour}:00 - ${startHour + 1}:00)`;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-8 bg-[#FBFBFB]">
      <div className="flex flex-col gap-5">
        
        <div className="flex flex-col gap-1">
          <label className="rasa-font font-bold text-[24px] text-black">Chuyên khoa *</label>
          <select value={formData.specialtyId} onChange={handleSpecialtyChange} disabled={fetchingSpecs} className="w-full border border-gray-300 px-3 py-2 text-[15px] text-gray-800 outline-none focus:border-[#0B1460] bg-white rasa-font">
            <option value="" disabled hidden>{fetchingSpecs ? "Đang tải..." : "Lựa chọn khoa"}</option>
            {specialties.map(spec => <option key={spec.id || spec._id} value={spec.id || spec._id}>{spec.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="rasa-font font-bold text-[24px] text-black">Bác sĩ *</label>
          <select value={formData.doctorId} onChange={handleDoctorChange} disabled={!formData.specialtyId || fetchingDocs} className="w-full border border-gray-300 px-3 py-2 text-[15px] text-gray-800 outline-none focus:border-[#0B1460] bg-white rasa-font">
            <option value="" disabled hidden>{!formData.specialtyId ? "Chọn khoa trước" : fetchingDocs ? "Đang tải..." : "Lựa chọn bác sĩ"}</option>
            {doctors.map(doc => <option key={doc.id || doc._id} value={doc.id || doc._id}>{doc.degree ? `${doc.degree} - ` : ""}{doc.profile?.fullName}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="rasa-font font-bold text-[24px] text-black">Ngày khám *</label>
          <input 
            type="date" 
            name="date" 
            value={formData.date} 
            onChange={handleChange} 
            className="w-full border border-gray-300 px-3 py-2 text-[15px] text-gray-500 outline-none focus:border-[#0B1460] bg-white rasa-font" 
          />
        </div>

        {formData.doctorId && formData.date && (
          <div className="flex flex-col gap-1">
            <label className="rasa-font font-bold text-[24px] text-black">Ca khám *</label>
            <select 
              name="shift" 
              value={formData.shift} 
              onChange={handleChange} 
              disabled={fetchingShifts || availableShifts.length === 0}
              className="w-full border border-gray-300 px-3 py-2 text-[15px] text-gray-500 outline-none focus:border-[#0B1460] bg-white rasa-font"
            >
              <option value="" disabled hidden>
                {fetchingShifts 
                  ? "Đang tải ca trống..." 
                  : availableShifts.length === 0 
                    ? "Bác sĩ đã kín lịch hoặc bạn đã đặt lịch vào ngày này" 
                    : "Lựa chọn ca khám"
                }
              </option>
              
              {availableShifts.map((slot) => (
                <option key={slot.shift} value={slot.shift}>
                  {formatShiftTime(slot.shift)}
                </option>
              ))}
              
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="rasa-font font-bold text-[24px] text-black">Lý do khám *</label>
          <textarea 
            name="reason" 
            value={formData.reason} 
            onChange={handleChange} 
            rows="3"
            placeholder="Ví dụ: Đau đầu, chóng mặt và buồn nôn 2 ngày nay..." 
            className="w-full border border-gray-300 px-3 py-2 text-[15px] text-gray-800 outline-none focus:border-[#0B1460] bg-white rasa-font resize-none" 
          />
        </div>

      </div>

      <div className="mt-12 flex justify-end">
        <button 
          onClick={handleSubmit} 
          disabled={loading} 
          className={`flex items-center justify-center gap-2 text-white rasa-font px-8 py-2 rounded-[20px] text-[15px] transition-colors duration-200 ${
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0B1460] hover:bg-[#152085]'
          }`}
        >
          {loading && (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {loading ? "Đang xử lý..." : "Xác nhận"}
        </button>
      </div>

    </div>
  );
}