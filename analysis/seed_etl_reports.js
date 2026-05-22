/**
 * seed_etl_reports.js
 * Seed dữ liệu mẫu vào bảng etl_reports cho 30 ngày gần đây.
 * Chạy: node seed_etl_reports.js
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Thử load .env local trước, nếu không có DATABASE_URL thì load từ backend
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: resolve(__dirname, '../backend/.env') });
}

import pg from 'pg';

// ─── Date helpers (không dùng date-fns) ─────────────────────────────────────
const formatDate = (d) => d.toISOString().slice(0, 10);
const subDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

// ─── Helpers ────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Dữ liệu mẫu ────────────────────────────────────────────────────────────
const DOCTORS = [
  { doctor_name: 'BS. Nguyễn Văn An', specialty_name: 'Tim mạch' },
  { doctor_name: 'BS. Trần Thị Bình', specialty_name: 'Nhi khoa' },
  { doctor_name: 'BS. Lê Hoàng Cường', specialty_name: 'Nội tổng hợp' },
  { doctor_name: 'BS. Phạm Minh Đức', specialty_name: 'Da liễu' },
  { doctor_name: 'BS. Hoàng Thu Hà', specialty_name: 'Thần kinh' },
  { doctor_name: 'BS. Vũ Quốc Hùng', specialty_name: 'Chỉnh hình' },
  { doctor_name: 'BS. Đặng Lan Hương', specialty_name: 'Sản phụ khoa' },
  { doctor_name: 'BS. Bùi Xuân Khoa', specialty_name: 'Tiêu hóa' },
];

const DISEASES = [
  { disease_name: 'Tăng huyết áp', specialty_name: 'Tim mạch' },
  { disease_name: 'Tiểu đường type 2', specialty_name: 'Nội tiết' },
  { disease_name: 'Viêm phổi', specialty_name: 'Hô hấp' },
  { disease_name: 'Thoái hóa khớp', specialty_name: 'Chỉnh hình' },
  { disease_name: 'Trào ngược dạ dày', specialty_name: 'Tiêu hóa' },
  { disease_name: 'Migraine', specialty_name: 'Thần kinh' },
  { disease_name: 'Mề đay mãn tính', specialty_name: 'Da liễu' },
  { disease_name: 'Viêm xoang', specialty_name: 'Tai mũi họng' },
];

const CHAT_TOPICS = [
  'symptom_inquiry',
  'doctor_search',
  'medicine_inquiry',
  'appointment_booking',
  'general_health',
  'emergency',
];

const SHIFTS = [1, 2, 3, 4, 5, 6, 7, 8]; // Ca khám trong ngày

const EVENT_TYPES = ['VIEW_DOCTOR', 'VIEW_DISEASE', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT'];

// ─── Generators ──────────────────────────────────────────────────────────────
function genTopDoctors(dateStr) {
  return DOCTORS.map((d, i) => {
    const views = rand(10, 120);
    const bookings = rand(2, 40);
    const cancels = rand(0, 5);
    return {
      doctor_name: d.doctor_name,
      specialty_name: d.specialty_name,
      view_count: views,
      booking_count: bookings,
      cancel_count: cancels,
      popularity_score: views * 1 + bookings * 5 - cancels * 3,
      date: dateStr,
    };
  }).sort((a, b) => b.popularity_score - a.popularity_score);
}

function genTopDiseases(dateStr) {
  return DISEASES.map((d) => {
    const views = rand(5, 100);
    const chatMentions = rand(1, 30);
    return {
      disease_name: d.disease_name,
      specialty_name: d.specialty_name,
      total_views: views,
      chat_mentions: chatMentions,
      interest_score: views * 1 + chatMentions * 4,
      date: dateStr,
    };
  }).sort((a, b) => b.interest_score - a.interest_score);
}

function genPeakShifts(dateStr) {
  return SHIFTS.map((shift) => ({
    shift_number: `Ca ${shift}`,
    total_events: rand(5, 80),
    date: dateStr,
  }));
}

function genDailySummary(dateStr) {
  return EVENT_TYPES.map((type) => ({
    event_type: type,
    total_count: rand(3, 60),
    date: dateStr,
  }));
}

function genChatTopics(dateStr) {
  return CHAT_TOPICS.map((topic) => ({
    topic,
    total_sessions: rand(1, 50),
    mention_count: rand(1, 30),
    date: dateStr,
  }));
}

function genRawEvents(dateStr) {
  const events = [];
  for (let i = 0; i < rand(20, 60); i++) {
    events.push({
      event_type: pick(EVENT_TYPES),
      user_id: `user_${rand(1, 100)}`,
      count: rand(1, 5),
      date: dateStr,
    });
  }
  return events;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function seed() {
  await client.connect();
  console.log('✅ Đã kết nối PostgreSQL');

  // Xóa data cũ trong 90 ngày để tránh trùng
  await client.query(`DELETE FROM etl_reports WHERE start_date >= NOW() - INTERVAL '90 days'`);
  console.log('🗑️  Đã xóa data cũ (90 ngày gần đây)');

  const today = new Date();
  let totalInserted = 0;

  // Seed 30 ngày gần đây
  for (let i = 30; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = formatDate(date);

    const reportsList = [
      { reportName: 'raw_events',    data: { previewData: genRawEvents(dateStr),    totalRows: rand(20, 60) } },
      { reportName: 'top_doctors',   data: { previewData: genTopDoctors(dateStr),   totalRows: DOCTORS.length } },
      { reportName: 'top_diseases',  data: { previewData: genTopDiseases(dateStr),  totalRows: DISEASES.length } },
      { reportName: 'peak_shifts',   data: { previewData: genPeakShifts(dateStr),   totalRows: SHIFTS.length } },
      { reportName: 'daily_summary', data: { previewData: genDailySummary(dateStr), totalRows: EVENT_TYPES.length } },
      { reportName: 'chat_topics',   data: { previewData: genChatTopics(dateStr),   totalRows: CHAT_TOPICS.length } },
    ];

    const totalEvents = rand(40, 200);

    await client.query('BEGIN');
    try {
      for (const report of reportsList) {
        await client.query(
          `INSERT INTO etl_reports (mode, report_name, start_date, end_date, total_events, reports)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            'daily',
            report.reportName,
            dateStr,
            dateStr,
            totalEvents,
            JSON.stringify(report.data),
          ]
        );
        totalInserted++;
      }
      await client.query('COMMIT');
      console.log(`  [${dateStr}] ✅ Inserted ${reportsList.length} reports`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [${dateStr}] ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n🎉 Seed hoàn tất! Tổng: ${totalInserted} rows vào etl_reports`);
  await client.end();
}

seed().catch((err) => {
  console.error('Seed thất bại:', err.message);
  process.exit(1);
});
