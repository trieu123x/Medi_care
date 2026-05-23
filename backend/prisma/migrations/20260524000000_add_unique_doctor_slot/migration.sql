-- RemoveDuplicateAppointments
-- Giữ lại appointment có createdAt mới nhất cho mỗi (doctor_id, date, shift), xóa những cái cũ
DELETE FROM "appointments"
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON ("doctor_id", "date", "shift") id
    FROM "appointments"
    ORDER BY "doctor_id", "date", "shift", "created_at" DESC
  ) AS latest
);

-- AddUniqueConstraint
ALTER TABLE "appointments" ADD CONSTRAINT "unique_doctor_slot" UNIQUE ("doctor_id", "date", "shift");

