"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { EditField } from "@/components/ui/EditField";
import { AvatarPicker } from "@/components/ui/ImagePicker";
import { Button } from "@/components/ui/Button";
import { userApi } from "@/routers/profile/profileRouter";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/utils/supabase";

export default function Detail() {
  const { user, isDoctor, isAdmin } = useAuthStore();
  const userId = user?.id;
  const [fullName, setFullName] = useState("");
  const [hometown, setHometown] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setFullName(user.fullName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setHometown(user.address || "");
      let avatarToSet = user.avatarUrl || "";
      if (avatarToSet && !avatarToSet.startsWith("http")) {
        avatarToSet = supabase.storage.from("avatars").getPublicUrl(avatarToSet)
          .data.publicUrl;
      }
      setCurrentAvatarUrl(avatarToSet);
    };

    fetchUserInfo();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const jsonPayload = {};
      if (fullName) jsonPayload.fullName = fullName;
      if (hometown) jsonPayload.address = hometown;
      if (email) jsonPayload.email = email;
      if (phone) jsonPayload.phone = phone;

      // Các trường thông tin khác
      const res = await userApi.updateUser(userId, jsonPayload);

      if (res && res.success) {
        alert("Cập nhật thông tin thành công!");
      } else {
        alert("Lỗi: " + (res?.message || "Không thể cập nhật"));
      }
    } catch (error) {
      console.error("Lỗi khi lưu thông tin:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Đã xảy ra lỗi hệ thống";
      alert(`Đã xảy ra lỗi: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file) => {
    if (!file) return;

    try {
      setSaving(true);

      // 1. Upload ảnh lên Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "medicare_avatar");
      const cloudName = "dfnlbrk4w";

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData },
      );

      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error.message);

      const publicUrl = uploadData.secure_url;

      // 2. Lưu URL vào backend
      const payload = new FormData();
      payload.append("avatarUrl", publicUrl);
      const res = await userApi.updateUser(userId, payload);

      if (!res || !res.success) {
        throw new Error(res?.message || "Lỗi khi lưu ảnh vào database");
      }

      setCurrentAvatarUrl(publicUrl);
      alert("Đã cập nhật ảnh đại diện mới thành công!");
    } catch (error) {
      console.error(error);
      alert("Lỗi upload: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="grow flex items-center justify-center bg-gray-50 min-h-[500px]">
        <p className="text-gray-500 font-medium">
          Vui lòng đăng nhập để xem và chỉnh sửa thông tin cá nhân.
        </p>
      </div>
    );
  }

  if (isDoctor || isAdmin) {
    return (
      <div className="grow flex flex-col items-center justify-center bg-gray-50 min-h-[500px] rasa-font">
        <p className="text-red-500 font-bold text-2xl mb-2">
          Truy cập bị từ chối!
        </p>
        <p className="text-gray-600 text-lg">
          Trang hồ sơ này chỉ dành riêng cho Bệnh nhân.
        </p>
      </div>
    );
  }

  return (
    <div className="grow flex flex-col rasa-font bg-gray-50">
      <div className="relative grow flex px-10 py-8 justify-between gap-35">
        <div className="w-200 flex flex-col flex-none">
          <InputForm
            label={"Họ và tên"}
            placeholder={"Nhập tên của bạn"}
            value={fullName}
            setValue={setFullName}
          />
          <InputForm
            label={"Quê quán"}
            placeholder={"Nhập quê quán của bạn"}
            value={hometown}
            setValue={setHometown}
          />
          <InputForm
            label={"Email"}
            placeholder={"Nhập email của bạn"}
            value={email}
            setValue={setEmail}
            isReadOnly={true}
          />
          <InputForm
            label={"Số điện thoại"}
            placeholder={"Nhập số điện thoại"}
            value={phone}
            setValue={setPhone}
          />
        </div>

        <div className="w-full">
          <AvatarPicker
            label="Ảnh đại diện"
            onChange={handleAvatarChange}
            defaultImage={currentAvatarUrl}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className={`absolute bottom-5 right-10 
          bg-[#070575] hover:bg-[#08069b] py-2 text-white transition-opacity
          ${saving ? "opacity-70 cursor-not-allowed" : ""}
        `}
        >
          {saving ? "Đang lưu..." : "Lưu lại thay đổi"}
        </Button>
      </div>
    </div>
  );
}

function InputForm({
  label,
  placeholder,
  value,
  setValue = (value) => {},
  mode = "normal",
  options = [],
  isReadOnly = false,
}) {
  return (
    <div className="w-full flex justify-between gap-3">
      <EditField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(newValue) => setValue(newValue)}
        className="w-full"
        mode={mode}
        options={options}
        readOnly={isReadOnly}
      />
      {isReadOnly ? (
        <div className="mt-11 size-6" />
      ) : (
        <Pencil className="mt-11 size-6 opacity-60" />
      )}
    </div>
  );
}
