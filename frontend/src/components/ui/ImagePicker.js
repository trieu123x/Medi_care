/* eslint-disable @next/next/no-img-element */
"use client"

import { useState, useRef, useEffect } from "react"
import { twMerge } from "tailwind-merge"
import Image from "next/image"

export function AvatarPicker({
  label = "Tiêu đề",
  onChange = (file) => { },
  className = "",
  defaultImage = null,
}) {
  const [previewUrl, setPreviewUrl] = useState(defaultImage)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setPreviewUrl(defaultImage)
  }, [defaultImage])

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result)
      }
      reader.readAsDataURL(file)
      onChange(file)
    }
    event.target.value = ''
  }

  return (
    <div className={twMerge("w-[220px] rasa-font", className)}>
      <div className="flex flex-col items-start">
        <label className="block text-[24px] font-bold text-black">
          {label}
        </label>

        <div
          className="relative group cursor-pointer rounded-[4px] w-full border border-black/10 overflow-hidden"
          onClick={() => fileInputRef.current.click()}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview ảnh đại diện"
              className="w-[220px] h-auto block object-contain"
            />
          ) : (
            <Image
              src="/images/Avartar.jpg"
              alt="Preview ảnh đại diện"
              width={220}
              height={220}
              className="w-full h-fit block object-cover"
            />
          )}

          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-white text-[15px] text-center leading-tight">
              Thay đổi ảnh
            </span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}