"use client"

import { useState, useEffect, Suspense } from "react"
import { Pencil } from "lucide-react"
import { EditField } from "@/components/ui/EditField"
import { AvatarPicker } from "@/components/ui/ImagePicker"
import { Button } from "@/components/ui/Button"
import { useSearchParams, useRouter } from "next/navigation"
import { getUserById, updateUser, createDoctorAccount } from "@/routers/user-api"
import { getAllDegrees } from "@/routers/degree-api"
import { getSpecialties } from "@/routers/specialty-api"

function DetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const id = searchParams.get("id")
  const isEditMode = !!id

  // State Form
  const [fullName, setFullName] = useState("")
  const [hometown, setHometown] = useState("") // Có thể map với field address trong DB
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [degree, setDegree] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [education, setEducation] = useState("")
  const [experience, setExperience] = useState("")
  const [achievements, setAchievements] = useState("")
  const [userRole, setUserRole] = useState(null)

  // State hỗ trợ logic nghiệp vụ
  const [initialData, setInitialData] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [loading, setLoading] = useState(isEditMode)
  const [degreeOptions, setDegreeOptions] = useState([])
  const [specialtyOptions, setSpecialtyOptions] = useState([])

  useEffect(() => {
    const initData = async () => {
      try {
        if (isEditMode) {
          let dataToUse = null

          // Lấy degrees song song với user
          const [degreesRes, specialtiesRes, userRes] = await Promise.all([
            getAllDegrees(),
            getSpecialties(),
            getUserById(id)
          ])

          if (degreesRes.data) {
            setDegreeOptions(degreesRes.data)
          }
          if (specialtiesRes.data) {
            setSpecialtyOptions(specialtiesRes.data)
          }

          if (userRes && userRes.data) {
            dataToUse = userRes.data
          }

          if (dataToUse) {
            setFullName(dataToUse.fullName || dataToUse.name || "")
            setHometown(dataToUse.address || "")
            setEmail(dataToUse.email || "")
            setPhone(dataToUse.phone || "")

            setDegree(dataToUse.doctor?.degree?.name || "")
            setSpecialty(dataToUse.doctor?.specialty?.name || "")
            setEducation(dataToUse.doctor?.education || "")
            setExperience(dataToUse.doctor?.experience || "")
            setAchievements(dataToUse.doctor?.achievements || "")

            setPreviewImage(dataToUse.avatarUrl || null)
            setUserRole(dataToUse.role || null)

            setInitialData({
              fullName: dataToUse.fullName || "",
              hometown: dataToUse.address || "",
              email: dataToUse.email || "",
              phone: dataToUse.phone || "",
              degree: dataToUse.doctor?.degree?.name || "",
              specialty: dataToUse.doctor?.specialty?.name || "",
              education: dataToUse.doctor?.education || "",
              experience: dataToUse.doctor?.experience || "",
              achievements: dataToUse.doctor?.achievements || ""
            })
          }
        } else {
          // Bật lấy độ nếu tạo mới
          const [degreesRes, specialtiesRes] = await Promise.all([
            getAllDegrees(),
            getSpecialties()
          ])
          if (degreesRes.data) {
            setDegreeOptions(degreesRes.data)
          }
          if (specialtiesRes.data) {
            setSpecialtyOptions(specialtiesRes.data)
          }
          // Chế độ thêm mới -> form rỗng
          setInitialData({
            fullName: "", hometown: "", email: "", phone: "",
            degree: "", specialty: "", education: "", experience: "", achievements: ""
          })
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu người dùng:", error)
      } finally {
        setLoading(false)
      }
    }
    initData()
  }, [id, isEditMode])

  const handleAvatarChange = (file) => {
    setImageFile(file)
  }

  // Hàm gom dữ liệu hiện tại để so sánh
  const getCurrentData = () => ({
    fullName, hometown, email, phone, degree, specialty, education, experience, achievements
  })

  // Logic kiểm tra có thay đổi hay không
  const hasChanges = () => {
    if (!initialData) return false
    if (imageFile !== null) return true
    return JSON.stringify(getCurrentData()) !== JSON.stringify(initialData)
  }

  // Luôn hiện nếu là "Thêm", chỉ hiện khi có thay đổi nếu là "Edit"
  const showSubmitButton = !isEditMode || hasChanges()

  const handleSubmit = async () => {
    try {
      const payload = new FormData()
      payload.append("fullName", fullName)
      payload.append("email", email)
      payload.append("phone", phone)

      if (imageFile) {
        if (typeof imageFile === 'string') {
          payload.append("avatarUrl", imageFile)
        } else {
          payload.append("avatar", imageFile)
        }
      }
      if (isEditMode) {
        payload.append("address", hometown)
        const selectedDegree = degreeOptions.find(d => d.name === degree)
        if (selectedDegree) {
          payload.append("degreeId", selectedDegree.id)
        } else {
          payload.append("degreeId", "")
        }

        const selectedSpecialty = specialtyOptions.find(s => s.name === specialty)
        if (selectedSpecialty) {
          payload.append("specialtyId", selectedSpecialty.id)
        } else {
          payload.append("specialtyId", "")
        }
        payload.append("education", education)
        payload.append("experience", experience)
        payload.append("achievements", achievements)

        await updateUser(id, payload)
        alert("Cập nhật thành công!")
        setInitialData(getCurrentData())
        setImageFile(null)
      } else {
        await createDoctorAccount(payload)
        alert("Tạo tài khoản bác sĩ thành công!")
        router.push("/admin/users")
      }
    } catch (error) {
      console.error("Lỗi lưu thay đổi:", error)
      alert("Lưu thất bại! Vui lòng kiểm tra lại (VD: Số điện thoại/Email có thể bị trùng).")
    }
  }

  if (loading) return <div className="p-10 italic text-gray-500">Đang tải dữ liệu...</div>

  return <div className="grow flex flex-col rasa-font bg-white">
    <div className="relative grow flex px-10 py-8 justify-between gap-35">
      <div className="w-200 flex flex-col flex-none">
        <InputForm label={"Họ và tên"} placeholder={"Nhập tên của bạn"}
          value={fullName} setValue={(value) => setFullName(value)} />
        <InputForm label={"Email"} placeholder={"Nhập email của bạn"}
          value={email} setValue={(value) => setEmail(value)} />
        <InputForm label={"Số điện thoại"} placeholder={"Nhập số điện thoại"}
          value={phone} setValue={(value) => setPhone(value)} />

        {isEditMode && (
          <>
            <InputForm label={"Quê quán"} placeholder={"Nhập quên quán của bạn"}
              value={hometown} setValue={(value) => setHometown(value)} />
            {userRole !== 'PATIENT' && (
              <>
                <InputForm label={"Bằng cấp"} placeholder={"Chọn bằng cấp"} options={degreeOptions.map(d => d.name)}
                  value={degree} setValue={(value) => setDegree(value)} mode={"select"} />
                <InputForm label={"Chuyên khoa"} placeholder={"Chọn chuyên khoa"} options={specialtyOptions.map(s => s.name)}
                  value={specialty} setValue={(value) => setSpecialty(value)} mode={"select"} />
                <InputForm label={"Trình độ học vấn"} placeholder={"Nhập thông tin"}
                  value={education} setValue={(value) => setEducation(value)} />
                <InputForm label={"Kinh nghiệm làm việc"} placeholder={"Nhập thông tin"}
                  value={experience} setValue={(value) => setExperience(value)} />
                <InputForm label={"Thành tựu"} placeholder={"Nhập thông tin"}
                  value={achievements} setValue={(value) => setAchievements(value)} />
              </>
            )}
          </>
        )}
      </div>

      <div className="w-full">
        <AvatarPicker
          label="Ảnh đại diện"
          onChange={handleAvatarChange}
          defaultImage={previewImage}
        />
      </div>

      {showSubmitButton && (
        <Button onClick={handleSubmit} className={`absolute bottom-5 right-10 
          bg-[#070575] hover:bg-[#08069b] py-2 text-white
        `}>
          {isEditMode ? "Lưu lại thay đổi" : "Thêm"}
        </Button>
      )}
    </div>
  </div>
}

export default function Detail() {
  return (
    <Suspense fallback={<div className="p-10 italic text-gray-500">Đang tải...</div>}>
      <DetailContent />
    </Suspense>
  )
}

function InputForm({ label, placeholder, value, setValue = (value) => { }, mode = "normal", options = [] }) {
  return <div className="w-full flex justify-between gap-3">
    <EditField
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(newValue) => setValue(newValue)}
      className="w-full"
      mode={mode}
      options={options} />
    <Pencil className="mt-11 size-6 opacity-60" />
  </div>
}