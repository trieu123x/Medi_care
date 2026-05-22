"use client"

import { HorizontalBarChart, KpiCard, VerticalBarChart } from "@/components/admin/dashboardWidget"
import { AggregateForm } from "@/components/admin/form"
import { Button } from "@/components/ui/Button"
import { startOfDay, endOfDay, subDays, format } from "date-fns"
import { CalendarSelectBox } from "@/components/ui/CalendarSelectBox"
import { Table } from "@/components/ui/Table"
import { Filter } from "lucide-react"
import { useEffect, useState } from "react"
import { getReportsByTimeRange } from "@/routers/report-api"
import { aggregateAndSortTopList } from "@/helper/aggregate-format"

const DOCTOR_COLUMNS = [
  { key: "doctor_name", label: "Tên Bác sĩ", width: "30%" },
  { key: "specialty_name", label: "Chuyên khoa", width: "25%" },
  { key: "view_count", label: "Lượt xem", width: "15%" },
  { key: "booking_count", label: "Lượt đặt", width: "15%" },
  { key: "popularity_score", label: "Điểm quan tâm", width: "15%" },
]

const DISEASE_COLUMNS = [
  { key: "disease_name", label: "Tên bệnh", width: "30%" },
  { key: "specialty_name", label: "Chuyên khoa", width: "25%" },
  { key: "total_views", label: "Lượt xem", width: "25%" },
  { key: "interest_score", label: "Điểm quan tâm", width: "20%" },
]

export default function Aggregate() {
  const [startDate, setStartDate] = useState(startOfDay(subDays(new Date(), 30)))
  const [endDate, setEndDate] = useState(endOfDay(new Date()))
  const [isLoading, setLoading] = useState(true)

  const [kpis, setKpis] = useState({ events: 0, visits: 0, chats: 0 })
  const [peakShifts, setPeakShifts] = useState([])
  const [chatTopics, setChatTopics] = useState([])

  const [tableMode, setTableMode] = useState("doctor") // "doctor" | "disease"
  const [topDoctors, setTopDoctors] = useState([])
  const [topDiseases, setTopDiseases] = useState([])

  const handleQuickSelect = (daysToSubtract) => {
    const today = new Date()
    const pastDate = subDays(today, daysToSubtract)

    setStartDate(startOfDay(pastDate))
    setEndDate(endOfDay(today))
  }

  const extractRows = (apiRes) => {
    const records = apiRes?.data || []
    let rows = []
    records.forEach(record => {
      const rep = record.reports
      if (Array.isArray(rep)) rows = [...rows, ...rep]
      else if (rep?.previewData) rows = [...rows, ...rep.previewData]
      else if (rep?.data?.previewData) rows = [...rows, ...rep.data.previewData]
    })
    return rows
  }

  useEffect(() => {
    const handleFetchReport = async () => {
      if (!startDate || !endDate) return

      try {
        const formattedStartDate = format(startDate, 'yyyy-MM-dd')
        const formattedEndDate = format(endDate, 'yyyy-MM-dd')

        // Dùng allSettled — 1 report không có data không làm sập các report khác
        const results = await Promise.allSettled([
          getReportsByTimeRange("daily_summary", formattedStartDate, formattedEndDate),
          getReportsByTimeRange("chat_topics", formattedStartDate, formattedEndDate),
          getReportsByTimeRange("top_doctors", formattedStartDate, formattedEndDate),
          getReportsByTimeRange("top_diseases", formattedStartDate, formattedEndDate),
          getReportsByTimeRange("peak_shifts", formattedStartDate, formattedEndDate)
        ])

        // Lấy giá trị thành công hoặc null nếu thất bại
        const [summerRes, chatRes, doctorRes, diseaseRes, peakShiftRes] = results.map(
          (r, i) => {
            if (r.status === 'fulfilled') return r.value
            console.warn(`[Report] API thất bại tại index ${i}:`, r.reason)
            return null
          }
        )

        const dailyRows = extractRows(summerRes)
        const chatRows = extractRows(chatRes)

        const totalEvents = dailyRows.reduce((sum, r) => sum + Number(r.total_count || 0), 0)
        const totalVisits = dailyRows
          .filter(r => ['VIEW_DOCTOR', 'VIEW_DISEASE'].includes(r.event_type))
          .reduce((sum, r) => sum + Number(r.total_count || 0), 0)
        const totalChats = chatRows.reduce((sum, r) => sum + Number(r.total_sessions || r.mention_count || 0), 0)

        setKpis({ events: totalEvents, visits: totalVisits, chats: totalChats })

        const peakRows = extractRows(peakShiftRes)

        const aggregatedPeakMap = peakRows.reduce((acc, row) => {
          const shift = row.shift_number
          if (!acc[shift]) {
            acc[shift] = 0
          }
          acc[shift] += Number(row.total_events || 0)
          return acc
        }, {})

        const formattedPeak = Object.keys(aggregatedPeakMap).map(shift => ({
          label: `${shift}`,
          value: aggregatedPeakMap[shift]
        })).sort((a, b) => parseInt(a.label.split(' ')[1]) - parseInt(b.label.split(' ')[1]))

        setPeakShifts(formattedPeak)

        const aggregatedChatMap = chatRows.reduce((acc, row) => {
          const topic = row.topic || "Khác"
          if (!acc[topic]) acc[topic] = 0
          acc[topic] += Number(row.total_sessions || row.mention_count || 0)
          return acc
        }, {})

        const formattedChats = Object.keys(aggregatedChatMap).map(topic => ({
          label: topic,
          value: aggregatedChatMap[topic]
        }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)

        setChatTopics(formattedChats)

        const doctorRows = extractRows(doctorRes)
        const diseaseRows = extractRows(diseaseRes)

        setTopDoctors(aggregateAndSortTopList(doctorRows, "doctor"))
        setTopDiseases(aggregateAndSortTopList(diseaseRows, "disease"))

      } catch (error) {
        console.error("Lỗi lấy báo cáo:", error)
      } finally {
        // Đảm bảo luôn tắt loading dù thành công hay thất bại
        setLoading(false)
      }
    }

    handleFetchReport()
  }, [startDate, endDate])

  if (isLoading) return <div className="p-10 italic text-gray-500">Đang tải dữ liệu...</div>

  return <div className="grow flex flex-col rasa-font bg-white">
    <div className="flex h-15 px-10 items-end justify-between">
      <div className="flex items-center gap-1">
        <Filter className="w-6 h-6 flex-none" />
        <h1 className="mr-2 text-[20px] flex-none">Bộ lọc:</h1>
        <CalendarSelectBox placeholder="Ngày bắt đầu"
          value={startDate} onChange={setStartDate} />

        <CalendarSelectBox placeholder="Ngày kết thúc"
          value={endDate} onChange={setEndDate} />
      </div>

      <div className="flex items-center gap-1.5">
        <Button onClick={() => handleQuickSelect(30)}
          className={`
          w-full flex items-center justify-between cursor-pointer
          border border-gray-300 rounded-[4px] 
          px-2 py-1 text-[14px] focus:outline-none
        `}>
          <span className="flex-1 text-left truncate">30 ngày gần đây</span>
        </Button>

        <Button onClick={() => handleQuickSelect(7)}
          className={`
          w-full flex items-center justify-between cursor-pointer
          border border-gray-300 rounded-[4px] 
          px-2 py-1 text-[14px] focus:outline-none
        `}>
          <span className="flex-1 text-left truncate">7 ngày gần đây</span>
        </Button>

        <Button onClick={() => handleQuickSelect(1)}
          className={`
          w-full flex items-center justify-between cursor-pointer
          border border-gray-300 rounded-[4px] 
          px-2 py-1 text-[14px] focus:outline-none
        `}>
          <span className="flex-1 text-left truncate">1 ngày gần đây</span>
        </Button>
      </div>
    </div>

    <div className="grow px-10 py-3 grid grid-cols-5 grid-rows-[repeat(6,140px)] gap-2">
      <div className="row-start-1 col-start-1">
        <AggregateForm title={"Tổng sự kiện"}>
          <KpiCard value={kpis.events} />
        </AggregateForm>
      </div>
      <div className="row-start-2 col-start-1">
        <AggregateForm title={"Tổng truy cập"}>
          <KpiCard value={kpis.visits} />
        </AggregateForm>
      </div>
      <div className="row-start-3 col-start-1">
        <AggregateForm title={"Tổng phiên chat"}>
          <KpiCard value={kpis.chats} />
        </AggregateForm>
      </div>

      <div className="row-start-1 col-start-2 row-span-3 col-span-2">
        <AggregateForm title={"Ca khám cao điểm"}>
          <span className="absolute top-2 right-2 text-[12px]">Đơn vị: lịch đặt khám</span>
          <VerticalBarChart data={peakShifts} />
        </AggregateForm>
      </div>

      <div className="row-start-1 col-start-4 row-span-3 col-span-2">
        <AggregateForm title={"Top chủ đề chat"}>
          <span className="absolute bottom-2 right-2 text-[12px]">Đơn vị: phiên chat</span>
          <HorizontalBarChart data={chatTopics} />
        </AggregateForm>
      </div>

      <div className="row-start-4 row-span-3 col-start-1 col-span-5">
        <AggregateForm title={"Bảng xếp hạng quan tâm (top 10)"}>
          <div className="absolute top-2 right-4 flex rounded-full text-white gap-1">
            <Button onClick={() => setTableMode("doctor")}
              className={`text-[13px] rounded-[10px]
              ${tableMode === "doctor" ? "bg-[#8080F8]" : "bg-[#A6A6C8] hover:bg-[#b9b9cd]"} 
            `}>
              Bác sĩ
            </Button>

            <Button onClick={() => setTableMode("disease")}
              className={`text-[13px] rounded-[10px]
              ${tableMode !== "doctor" ? "bg-[#8080F8]" : "bg-[#A6A6C8] hover:bg-[#b9b9cd]"}
            `}>
              Bệnh
            </Button>
          </div>

          <Table
            data={tableMode === "doctor" ? topDoctors : topDiseases}
            columns={tableMode === "doctor" ? DOCTOR_COLUMNS : DISEASE_COLUMNS}
            className="px-2 absolute top-13 h-90"
            headerClassName="[box-shadow:inset_0_-1px_0_black] bg-white text-black"
          />
        </AggregateForm>
      </div>
    </div>
  </div>
}