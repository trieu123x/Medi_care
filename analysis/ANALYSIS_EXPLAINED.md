# 📊 Folder `analysis` — ETL Data Pipeline

## Mục đích tổng quan

Folder `analysis` là một **ETL Pipeline** (Extract → Transform → Load) độc lập, chạy riêng biệt với backend.

**Nhiệm vụ chính:**
- **Hút dữ liệu** từ bảng `user_events` trên PostgreSQL (hành vi người dùng trong ngày)
- **Tính toán / tổng hợp** thành 6 loại báo cáo phân tích (bác sĩ nổi bật, bệnh quan tâm, ca cao điểm...)
- **Lưu kết quả** ra file Parquet → upload lên Supabase Storage + ghi metadata vào bảng `etl_reports`
- **Xóa dữ liệu raw** trên PostgreSQL sau khi đã lưu an toàn (tránh bảng phình to)

> **Tại sao cần pipeline riêng?**
> Việc tính toán analytics trực tiếp trên PostgreSQL production sẽ gây chậm hệ thống. ETL này dùng **DuckDB in-memory** như một bộ xử lý trung gian — đọc nhanh, tính toán nhanh, không ảnh hưởng backend.

---

## Cấu trúc thư mục

```
analysis/
├── package.json                  # Dependencies: duckdb-async, node-cron, pg, supabase-js
├── seed_etl_reports.js           # Script seed dữ liệu giả để test
└── src/
    ├── index.js                  # 🚀 Entry point — điều phối chạy manual hoặc cron
    ├── config/
    │   ├── duckDB.js             # Class DuckDB — wrapper kết nối in-memory DB
    │   └── supabase.js           # Khởi tạo Supabase client + hàm upload Storage
    ├── helpers/
    │   ├── constants.js          # Bảng điểm SCORES + danh sách REPORTS registry
    │   ├── dates.js              # Các hàm xử lý ngày tháng
    │   └── logger.js             # Logger có màu sắc cho terminal
    ├── extract/
    │   └── pull_events.js        # Phase 1: Đọc dữ liệu từ PostgreSQL vào DuckDB
    ├── transform/
    │   ├── raw_events.js         # Báo cáo 1: Lưu toàn bộ events gốc
    │   ├── top_doctors.js        # Báo cáo 2: Xếp hạng bác sĩ theo chuyên khoa
    │   ├── top_diseases.js       # Báo cáo 3: Bệnh được quan tâm nhiều nhất
    │   ├── peak_shifts.js        # Báo cáo 4: Ca khám cao điểm trong ngày
    │   ├── daily_summary.js      # Báo cáo 5: Tổng kết theo loại event
    │   └── chat_topics.js        # Báo cáo 6: Chủ đề AI chat phổ biến nhất
    ├── load/
    │   ├── to_parquet.js         # Export DuckDB table → file .parquet tạm
    │   ├── to_storage.js         # Upload file .parquet → Supabase Storage
    │   ├── to_db.js              # Lưu metadata báo cáo → bảng etl_reports (PostgreSQL)
    │   └── purge_events.js       # Xóa raw events cũ khỏi PostgreSQL
    └── pipeline/
        └── schedule.js           # Điều phối toàn bộ 4 phase E→T→L→Purge
```

---

## Luồng hoạt động tổng thể

```
node src/index.js
        │
        ├─ --schedule  → Cron job (2h sáng hàng ngày)
        └─ --test      → Chạy thủ công ngay lập tức
                │
                ▼
        runScheduled(mode, startDate, endDate)     [pipeline/schedule.js]
                │
                ├─ PHASE 1: EXTRACT
                │      └─ extractEvents()          [extract/pull_events.js]
                │              ├─ DuckDB attach PostgreSQL (READ_ONLY)
                │              ├─ Query bảng user_events → daily_events (DuckDB)
                │              └─ Tách thành: doctor_events, disease_events, chat_events
                │
                ├─ PHASE 2: TRANSFORM (loop 6 reports)
                │      ├─ transformRawEvents()     → result_raw_events
                │      ├─ transformTopDoctors()    → result_top_doctors
                │      ├─ transformTopDiseases()   → result_top_diseases
                │      ├─ transformPeakShifts()    → result_peak_shifts
                │      ├─ transformDailySummary()  → result_daily_summary
                │      └─ transformChatTopics()    → result_chat_topics
                │
                ├─ PHASE 3: LOAD
                │      ├─ exportToParquet()        → /output/*.parquet (tạm thời)
                │      └─ uploadReport()           → Supabase Storage bucket
                │
                ├─ PHASE 4: PURGE
                │      └─ purgeEvents()            → DELETE FROM user_events (PG-Direct)
                │
                └─ FINALIZE
                       ├─ saveEtlReport()          → INSERT INTO etl_reports (PG-Direct)
                       └─ cleanupParquetFiles()    → Xóa file .parquet tạm
```

---

## Chi tiết từng file

### 🚀 `src/index.js` — Entry Point

**Vai trò:** Điểm khởi động duy nhất của toàn bộ pipeline. Nhận tham số từ command line và quyết định chạy theo mode nào.

**Luồng xử lý:**
1. Đọc biến môi trường từ `.env` (`dotenv.config()`)
2. Parse arguments từ `process.argv`:
   - `--schedule` → Bật cron job chạy tự động mỗi đêm lúc **2:00 AM** (timezone `Asia/Ho_Chi_Minh`)
   - `--test [mode] [date]` → Chạy một lần thủ công (dùng để debug / backfill)
3. Gọi `runScheduled()` từ pipeline

**Các lệnh chạy:**
```bash
# Bật daemon chạy tự động mỗi đêm
node src/index.js --schedule

# Chạy thủ công với dữ liệu hôm qua
node src/index.js --test daily

# Chạy thủ công với ngày cụ thể
node src/index.js --test daily 2026-03-24
```

---

### 🔧 `src/config/duckDB.js` — DuckDB Wrapper

**Vai trò:** Class bọc toàn bộ thao tác với DuckDB để dùng chung trong pipeline.

| Method | Mô tả |
|---|---|
| `init()` | Tạo DuckDB in-memory (`':memory:'`) — không lưu file |
| `attachPg(url)` | Cài extension postgres, gắn PostgreSQL vào DuckDB với alias `pg` (READ_ONLY) |
| `reattachWritable()` | Gắn lại PostgreSQL với quyền ghi (dùng khi cần write) |
| `exec(sql)` | Thực thi SQL không trả kết quả (CREATE TABLE, INSERT...) |
| `query(sql)` | Thực thi SQL và trả về array rows |
| `count(table)` | Đếm số rows trong một table |
| `exportParquet(table, filePath)` | Export table ra file `.parquet` (nén ZSTD) |
| `close()` | Đóng kết nối DuckDB |

> **Tại sao dùng DuckDB?**
> DuckDB là OLAP database chạy in-memory, rất nhanh với analytical queries (GROUP BY, COUNT, PARTITION BY...). Cho phép JOIN trực tiếp với PostgreSQL mà không cần copy toàn bộ dữ liệu về.

---

### 🔧 `src/config/supabase.js` — Supabase Client

**Vai trò:** Khởi tạo Supabase client và cung cấp hàm upload file lên Supabase Storage.

**Hàm chính:**
```js
uploadToStorage(bucketName, storagePath, fileBuffer)
// → Upload buffer vào: bucket/analytics/{storagePath}
// → upsert: true (ghi đè nếu file đã tồn tại)
```

---

### 📋 `src/helpers/constants.js` — Hằng số toàn cục

**Vai trò:** Định nghĩa hai thứ quan trọng:

**1. Bảng điểm `SCORES`** — dùng để tính `popularity_score` và `interest_score`:
```js
VIEW_DOCTOR:        +1  // Xem trang bác sĩ
BOOK_APPOINTMENT:   +5  // Đặt lịch khám (quan trọng nhất)
CANCEL_APPOINTMENT: -3  // Hủy lịch (trừ điểm)
VIEW_DISEASE:       +1  // Xem thông tin bệnh
CHAT_AI_TOPIC:      +4  // Hỏi AI về chủ đề
```

**2. Registry `REPORTS`** — danh sách 6 báo cáo pipeline sẽ loop qua:
```js
{ name: 'raw_events',    table: 'result_raw_events',    label: '...' }
{ name: 'top_doctors',   table: 'result_top_doctors',   label: '...' }
{ name: 'top_diseases',  table: 'result_top_diseases',  label: '...' }
{ name: 'peak_shifts',   table: 'result_peak_shifts',   label: '...' }
{ name: 'daily_summary', table: 'result_daily_summary', label: '...' }
{ name: 'chat_topics',   table: 'result_chat_topics',   label: '...' }
```

---

### 📋 `src/helpers/dates.js` — Xử lý ngày tháng

| Hàm | Mô tả |
|---|---|
| `getYesterday()` | Trả về chuỗi ngày hôm qua: `'YYYY-MM-DD'` |
| `formatDate(date)` | Format Date object → `'YYYY-MM-DD'` |
| `getTimestamp()` | Timestamp hiện tại theo múi giờ VN để ghi log |
| `getDailyRange()` | Trả về `{ startDate, endDate }` đều là hôm qua |

---

### 📋 `src/helpers/logger.js` — Logger có màu

**Vai trò:** In log ra terminal với màu sắc và format đẹp.

| Method | Màu | Dùng khi |
|---|---|---|
| `log.info(msg)` | Xám nhạt | Thông tin thông thường |
| `log.success(msg)` | Xanh lá | Thành công |
| `log.warn(msg)` | Vàng | Cảnh báo |
| `log.error(msg)` | Đỏ | Lỗi |
| `log.phase(name)` | Xanh dương đậm | Tiêu đề từng phase |
| `log.result(label, value)` | Bình thường | Kết quả số liệu |
| `log.banner(title, lines)` | Khung ASCII | Tiêu đề lớn đầu/cuối pipeline |

---

### 📥 `src/extract/pull_events.js` — Phase 1: Extract

**Vai trò:** Đọc dữ liệu từ PostgreSQL vào DuckDB và tách thành các sub-table theo nhóm.

**Luồng chi tiết:**
1. **Chuẩn hóa timestamp**: Convert `YYYY-MM-DD` → UTC ISO string để tránh lỗi múi giờ
   - `startDate` = `2026-05-31T00:00:00.000Z`
   - `endDate`   = `2026-06-01T00:00:00.000Z` (ngày kế tiếp, dùng `<` thay vì `<=`)
2. **Query PostgreSQL qua DuckDB**: Tạo bảng `daily_events` trong bộ nhớ
3. **Tách sub-tables** theo `event_type`:

| Table | Điều kiện |
|---|---|
| `doctor_events` | `event_type IN ('VIEW_DOCTOR', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT')` |
| `disease_events` | `event_type = 'VIEW_DISEASE'` |
| `chat_events` | `event_type = 'CHAT_AI_TOPIC'` + trích xuất `metadata->>'topic'` và `metadata->>'sessionId'` |

**Trả về:** `{ total, doctor, disease, chat }` — số lượng từng nhóm

---

### 🔄 `src/transform/` — Phase 2: Transform (6 báo cáo)

#### `raw_events.js` — Báo cáo 1: Raw Events (Archive)
- **Input:** `daily_events`
- **Output:** `result_raw_events`
- **Mục đích:** Lưu nguyên xi toàn bộ events của ngày để làm kho lưu trữ dài hạn
- **Không tính toán gì thêm**, chỉ copy các cột: `id, user_id, event_type, metadata, created_at`

---

#### `top_doctors.js` — Báo cáo 2: Top Bác sĩ theo Chuyên khoa
- **Input:** `doctor_events`
- **Output:** `result_top_doctors`
- **Thuật toán:**
  1. Tính `popularity_score` = `views×1 + bookings×5 + cancels×(-3)` cho mỗi bác sĩ
  2. JOIN với bảng `doctors`, `profiles`, `specialties` trên PostgreSQL để lấy tên và chuyên khoa
  3. Dùng `ROW_NUMBER() OVER (PARTITION BY specialty_id ORDER BY score DESC)` để xếp hạng **trong từng chuyên khoa**
  4. Lọc bỏ bác sĩ có score ≤ 0
- **Kết quả:** Mỗi row chứa: `doctor_id, doctor_name, specialty_name, view_count, booking_count, cancel_count, popularity_score, unique_users, rank_in_specialty`

---

#### `top_diseases.js` — Báo cáo 3: Bệnh được quan tâm nhiều nhất
- **Input:** `disease_events`
- **Output:** `result_top_diseases`
- **Thuật toán:**
  1. Đếm số lần xem (`view_count`) theo từng `diseaseId` từ metadata
  2. Tính `interest_score = view_count × 1`
  3. JOIN với `diseases` và `specialties` để lấy tên bệnh và chuyên khoa
- **Kết quả:** Xếp theo `interest_score DESC`

---

#### `peak_shifts.js` — Báo cáo 4: Ca khám cao điểm
- **Input:** `daily_events`
- **Output:** `result_peak_shifts`
- **Thuật toán:**
  1. Lấy `shift` từ `metadata->>'shift'` (số ca: 1, 2, 3...)
  2. Đếm `total_events`, `unique_users`, `bookings` theo từng ca
  3. Tính `percentage` = phần trăm mỗi ca so với tổng (dùng window function `SUM() OVER()`)
- **Kết quả:** Biết ca nào trong ngày có lượng hoạt động cao nhất

---

#### `daily_summary.js` — Báo cáo 5: Tổng kết ngày
- **Input:** `daily_events`
- **Output:** `result_daily_summary`
- **Thuật toán:** GROUP BY `event_type`, đếm tổng số và số user unique, thời điểm đầu/cuối
- **Kết quả:** Mỗi row là một loại event với: `event_type, total_count, unique_users, first_event, last_event`

---

#### `chat_topics.js` — Báo cáo 6: Chủ đề AI Chat phổ biến
- **Input:** `chat_events` (đã có cột `chat_topic` và `session_id` từ phase Extract)
- **Output:** `result_chat_topics`
- **Thuật toán:** GROUP BY `chat_topic`, đếm số lần đề cập, user unique, số session
- **Kết quả:** Xếp theo `total_sessions DESC` — biết người dùng đang hỏi AI về bệnh gì nhiều nhất

---

### 💾 `src/load/` — Phase 3: Load + Phase 4: Purge

#### `to_parquet.js` — Export ra file .parquet tạm
- **Hàm `exportToParquet(db, tableName, reportName, dateStr)`:**
  1. Tạo thư mục `analysis/output/` nếu chưa tồn tại
  2. Gọi `db.exportParquet()` → DuckDB ghi file `output/{reportName}_{dateStr}.parquet` (nén ZSTD)
  3. Trả về đường dẫn file
- **Hàm `cleanupParquetFiles()`:** Xóa toàn bộ file `.parquet` trong `/output/` sau khi đã upload xong

---

#### `to_storage.js` — Upload lên Supabase Storage
- **Hàm `uploadReport(filePath, reportName, dateStr)`:**
  1. Đọc file `.parquet` thành Buffer
  2. Gọi `uploadToStorage()` → Supabase Storage
  3. Đường dẫn lưu trữ: `analytics/{dateStr}/{reportName}.parquet`

Ví dụ: `analytics/2026-05-31/top_doctors.parquet`

---

#### `to_db.js` — Lưu metadata vào PostgreSQL
- **Hàm `saveEtlReport(payload)`:**
  1. Kết nối PostgreSQL trực tiếp (không qua DuckDB)
  2. Dùng **transaction** (`BEGIN` → `COMMIT` / `ROLLBACK`)
  3. INSERT vào bảng `etl_reports` cho mỗi trong 6 báo cáo:
     - `mode, report_name, start_date, end_date, total_events`
     - `reports` (JSON): chứa `totalRows, storagePath, previewData` (20 rows đầu)
  4. Đây chính là nguồn dữ liệu mà **Report API** (`/report/by-time`, `/report/:id`) đọc ra

---

#### `purge_events.js` — Xóa raw events cũ
- **Hàm `purgeEvents(dateStr)`:**
  1. Kết nối PostgreSQL trực tiếp
  2. `DELETE FROM user_events WHERE created_at >= $1 AND created_at < $1 + INTERVAL '1 day'`
  3. Mục đích: Sau khi đã lưu dữ liệu an toàn lên Supabase Storage, xóa events thô khỏi DB production để tránh bảng phình to

> ⚠️ Đây là thao tác **không thể hoàn tác**. Pipeline chỉ chạy bước này sau khi đã upload file `.parquet` thành công.

---

### ⚙️ `src/pipeline/schedule.js` — Điều phối chính

**Vai trò:** Hàm trung tâm `runScheduled()` điều phối toàn bộ 4 phase theo thứ tự.

**Luồng đầy đủ:**
```
1. Kiểm tra DATABASE_URL có trong .env không
2. Khởi tạo DuckDB in-memory
3. Attach PostgreSQL (READ_ONLY)

── PHASE 1: EXTRACT ──
4. extractEvents() → daily_events + 3 sub-tables trong DuckDB

── PHASE 2: TRANSFORM ──
5. Loop qua REPORTS[] → gọi từng transform function
   → Tạo 6 bảng result_* trong DuckDB

── PHASE 3: LOAD ──
6. Loop qua REPORTS[] → exportToParquet() → /output/*.parquet
7. Lấy count + preview (20 rows) từ mỗi bảng result_*
8. uploadReport() → Supabase Storage (6 files)

── PHASE 4: PURGE ──
9. purgeEvents() → DELETE FROM user_events trên PostgreSQL

── FINALIZE ──
10. saveEtlReport() → INSERT INTO etl_reports (transaction)
11. cleanupParquetFiles() → Xóa file .parquet tạm
12. db.close()
13. Trả về resultPayload: { mode, totalEvents, purgedEvents, elapsedSeconds, ... }
```

---

## Kết nối với Report API

Folder `analysis` và backend **hoàn toàn độc lập** nhưng dùng chung database:

```
analysis/ (ETL Pipeline)          backend/ (API Server)
         │                                  │
         │  INSERT INTO etl_reports         │  SELECT FROM etl_reports
         └──────────────────────────────────┘
                    PostgreSQL
                  (bảng etl_reports)
```

- **Analysis** ghi dữ liệu vào bảng `etl_reports` sau mỗi lần chạy
- **Report API** (`GET /report/by-time`, `GET /report/:id`) đọc từ bảng đó và trả về cho dashboard frontend

---

## Dependencies

| Package | Vai trò |
|---|---|
| `duckdb-async` | In-memory OLAP database, xử lý analytical queries |
| `node-cron` | Lên lịch cron job tự động |
| `@supabase/supabase-js` | Upload file lên Supabase Storage |
| `pg` | Kết nối PostgreSQL trực tiếp (không qua ORM) |
| `dotenv` | Đọc biến môi trường từ `.env` |
