import "dotenv/config";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Map: tên chuyên khoa → tên nhóm bệnh phù hợp
const SPECIALTY_TO_CATEGORY = {
  "Nội tổng quát":       "Mãn tính",
  "Ngoại tổng quát":     "Ngoại khoa",
  "Nam khoa":            "Nam khoa",
  "Sản phụ khoa":        "Phụ khoa",
  "Tai mũi họng":        "Tai mũi họng",
  "Răng hàm mặt":        "Răng miệng",
  "Nhãn khoa":           "Mắt",
  "Tiết niệu":           "Tiết niệu",
  "Ung bướu":            "Ung bướu",
  "Phục hồi chức năng":  "Phục hồi chức năng",
  "Tâm thần":            "Thần kinh",
  "Dị ứng miễn dịch":    "Dị ứng",
  "Da liễu":             "Da liễu",
  "Hô hấp":              "Hô hấp",
  "Tim mạch":            "Tim mạch",
  "Tiêu hóa":            "Tiêu hóa",
  "Thần kinh":           "Thần kinh",
  "Cơ xương khớp":       "Xương khớp",
  "Nhi khoa":            "Nhi",
  "Phụ sản":             "Phụ khoa",
  "Nội tiết":            "Nội tiết",
};

// Các category cần đảm bảo tồn tại
const REQUIRED_CATEGORIES = [
  "Ngoại khoa", "Nam khoa", "Phụ khoa", "Tai mũi họng",
  "Răng miệng", "Mắt", "Tiết niệu", "Ung bướu",
  "Phục hồi chức năng", "Dị ứng",
  // Các category đã có từ seed gốc
  "Truyền nhiễm", "Mãn tính", "Da liễu", "Tim mạch",
  "Tiêu hóa", "Thần kinh", "Xương khớp", "Hô hấp", "Nội tiết", "Nhi",
];

async function main() {
  console.log("🔧 Bắt đầu fix categoryId cho các bệnh...\n");

  // 1. Đảm bảo các category cần thiết đã tồn tại
  console.log("📁 Kiểm tra và tạo nhóm bệnh còn thiếu...");
  const categoryMap = {}; // name → id

  for (const name of REQUIRED_CATEGORIES) {
    let cat = await prisma.diseaseCategory.findFirst({ where: { name } });
    if (!cat) {
      cat = await prisma.diseaseCategory.create({
        data: { name, description: `Nhóm bệnh ${name}` }
      });
      console.log(`  ✅ Tạo nhóm bệnh mới: ${name}`);
    } else {
      console.log(`  ⏭️  Đã có nhóm bệnh: ${name}`);
    }
    categoryMap[name] = cat.id;
  }

  // 2. Lấy tất cả chuyên khoa
  const specialties = await prisma.specialty.findMany();
  const specialtyMap = {}; // id → name
  for (const sp of specialties) {
    specialtyMap[sp.id] = sp.name;
  }

  // 3. Lấy tất cả bệnh đang có categoryId = null
  const diseasesWithNullCategory = await prisma.disease.findMany({
    where: { categoryId: null }
  });

  console.log(`\n🏥 Tìm thấy ${diseasesWithNullCategory.length} bệnh có categoryId = null. Đang fix...`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const disease of diseasesWithNullCategory) {
    const specialtyName = disease.specialtyId ? specialtyMap[disease.specialtyId] : null;
    const categoryName = specialtyName ? SPECIALTY_TO_CATEGORY[specialtyName] : null;
    const categoryId = categoryName ? categoryMap[categoryName] : null;

    if (categoryId) {
      await prisma.disease.update({
        where: { id: disease.id },
        data: { categoryId }
      });
      fixedCount++;
      console.log(`  ✅ ${disease.name} → ${categoryName}`);
    } else {
      // Gán vào category "Mãn tính" làm mặc định nếu không map được
      const fallbackId = categoryMap["Mãn tính"] || Object.values(categoryMap)[0];
      await prisma.disease.update({
        where: { id: disease.id },
        data: { categoryId: fallbackId }
      });
      skippedCount++;
      console.log(`  ⚠️  ${disease.name} (specialty: ${specialtyName || "null"}) → Mãn tính (mặc định)`);
    }
  }

  // 4. Thống kê sau khi fix
  const totalNull = await prisma.disease.count({ where: { categoryId: null } });

  console.log("\n==================================================");
  console.log(`🎉 HOÀN TẤT FIX!`);
  console.log(`   - Đã fix đúng category: ${fixedCount} bệnh`);
  console.log(`   - Gán mặc định: ${skippedCount} bệnh`);
  console.log(`   - Bệnh vẫn còn null: ${totalNull}`);
  console.log("==================================================");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
