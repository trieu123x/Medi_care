import "dotenv/config";
import { prisma } from "../configs/prisma-config.js";
import axios from "axios";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// ── Master Data ──────────────────────────────────────────────────────────────
const SPECIALTIES = [
  { name: "Tim mạch",       basePrice: 300000, description: "Khám và điều trị bệnh tim mạch" },
  { name: "Nhi khoa",       basePrice: 250000, description: "Chuyên khoa nhi từ sơ sinh đến 16 tuổi" },
  { name: "Nội tổng hợp",   basePrice: 200000, description: "Khám bệnh nội khoa tổng quát" },
  { name: "Da liễu",        basePrice: 220000, description: "Bệnh da, tóc, móng và niêm mạc" },
  { name: "Thần kinh",      basePrice: 280000, description: "Bệnh não, tủy sống và thần kinh ngoại biên" },
  { name: "Tiêu hóa",       basePrice: 260000, description: "Dạ dày, ruột, gan mật, tụy" },
  { name: "Cơ xương khớp",  basePrice: 240000, description: "Bệnh xương, khớp, cơ, gân" },
  { name: "Sản phụ khoa",   basePrice: 270000, description: "Sức khỏe sinh sản phụ nữ" },
];

const CATEGORIES = [
  { name: "Bệnh tim mạch",   description: "Các bệnh liên quan đến tim và mạch máu" },
  { name: "Bệnh tiêu hóa",   description: "Bệnh lý đường tiêu hóa" },
  { name: "Bệnh thần kinh",  description: "Rối loạn hệ thần kinh" },
  { name: "Bệnh da liễu",    description: "Các bệnh về da" },
  { name: "Bệnh cơ xương",   description: "Bệnh lý cơ xương khớp" },
  { name: "Bệnh nhi khoa",   description: "Bệnh thường gặp ở trẻ em" },
];

const MED_TYPES = [
  { name: "Thuốc uống",   description: "Dạng viên, nang, dung dịch uống" },
  { name: "Thuốc tiêm",   description: "Dạng dung dịch tiêm" },
  { name: "Thuốc bôi",    description: "Kem, gel, mỡ bôi ngoài da" },
  { name: "Thuốc nhỏ mắt", description: "Dung dịch nhỏ mắt" },
];

const DEGREES = [
  { name: "Giáo sư - Tiến sĩ", description: "GS.TS", rankWeight: 100 },
  { name: "Tiến sĩ",           description: "TS",     rankWeight: 90 },
  { name: "Bác sĩ CKI",        description: "BSCKI",  rankWeight: 70 },
  { name: "Thạc sĩ",           description: "ThS",    rankWeight: 60 },
];

// ── Seed Helpers ─────────────────────────────────────────────────────────────
async function upsertSpecialties() {
  const results = {};
  for (const s of SPECIALTIES) {
    const rec = await prisma.specialty.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, basePrice: s.basePrice, description: s.description },
    });
    results[s.name] = rec.id;
  }
  console.log(`✅ Specialties: ${Object.keys(results).length}`);
  return results;
}

async function upsertCategories() {
  const results = {};
  for (const c of CATEGORIES) {
    const rec = await prisma.diseaseCategory.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, description: c.description },
    });
    results[c.name] = rec.id;
  }
  console.log(`✅ Disease categories: ${Object.keys(results).length}`);
  return results;
}

async function upsertMedTypes() {
  const results = {};
  for (const t of MED_TYPES) {
    const rec = await prisma.medicineType.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, description: t.description },
    });
    results[t.name] = rec.id;
  }
  console.log(`✅ Medicine types: ${Object.keys(results).length}`);
  return results;
}

async function upsertDegrees() {
  const results = {};
  for (const d of DEGREES) {
    const rec = await prisma.degree.upsert({
      where: { name: d.name },
      update: {},
      create: { name: d.name, description: d.description, rankWeight: d.rankWeight },
    });
    results[d.name] = rec.id;
  }
  console.log(`✅ Degrees: ${Object.keys(results).length}`);
  return results;
}

async function seedDiseases(specIds, catIds) {
  const data = [
    { name: "Tăng huyết áp", spec: "Tim mạch", cat: "Bệnh tim mạch",
      symptoms: "Đau đầu, chóng mặt, huyết áp cao trên 140/90 mmHg, mờ mắt, khó thở khi gắng sức",
      description: "Bệnh mạn tính do áp lực máu trong động mạch tăng cao kéo dài.",
      homeTreatment: "Giảm muối, tập thể dục đều, bỏ thuốc lá, giảm cân nếu béo phì" },
    { name: "Nhồi máu cơ tim", spec: "Tim mạch", cat: "Bệnh tim mạch",
      symptoms: "Đau ngực dữ dội lan ra cánh tay trái và hàm, buồn nôn, vã mồ hôi lạnh, khó thở",
      description: "Tắc nghẽn động mạch vành gây hoại tử một phần cơ tim.",
      homeTreatment: "Cần cấp cứu ngay, không tự điều trị tại nhà" },
    { name: "Tiểu đường type 2", spec: "Nội tổng hợp", cat: "Bệnh tim mạch",
      symptoms: "Khát nước nhiều, tiểu nhiều, mệt mỏi, mờ mắt, vết thương chậm lành",
      description: "Rối loạn chuyển hóa glucose do kháng insulin hoặc thiếu insulin tương đối.",
      homeTreatment: "Chế độ ăn ít carb, tập thể dục 30 phút/ngày, kiểm soát cân nặng" },
    { name: "Viêm dạ dày", spec: "Tiêu hóa", cat: "Bệnh tiêu hóa",
      symptoms: "Đau thượng vị, buồn nôn, ợ hơi, chướng bụng, ăn không ngon, có thể nôn máu",
      description: "Viêm lớp niêm mạc dạ dày do vi khuẩn H. pylori, NSAID hoặc stress.",
      homeTreatment: "Ăn chín uống sôi, tránh rượu bia và đồ cay, ăn nhiều bữa nhỏ" },
    { name: "Trào ngược dạ dày thực quản", spec: "Tiêu hóa", cat: "Bệnh tiêu hóa",
      symptoms: "Ợ nóng, ợ chua, đau sau xương ức, khó nuốt, ho mãn tính về đêm",
      description: "Acid dạ dày trào ngược lên thực quản gây kích ứng niêm mạc.",
      homeTreatment: "Không ăn trước ngủ 3 tiếng, kê cao đầu giường, tránh đồ béo và chua" },
    { name: "Migraine (Đau nửa đầu)", spec: "Thần kinh", cat: "Bệnh thần kinh",
      symptoms: "Đau nửa đầu dữ dội, nhạy cảm ánh sáng và tiếng ồn, buồn nôn, nôn",
      description: "Rối loạn thần kinh mạch máu gây đau đầu tái phát từng cơn.",
      homeTreatment: "Nghỉ ngơi phòng tối yên tĩnh, chườm lạnh, tránh stress và thiếu ngủ" },
    { name: "Mề đay mãn tính", spec: "Da liễu", cat: "Bệnh da liễu",
      symptoms: "Nổi mẩn đỏ ngứa dữ dội, phù nề, ban xuất hiện và biến mất trong 24 giờ",
      description: "Phản ứng dị ứng da kéo dài trên 6 tuần do nhiều nguyên nhân.",
      homeTreatment: "Tránh tác nhân gây dị ứng, mặc quần áo rộng, tắm nước mát" },
    { name: "Thoái hóa khớp gối", spec: "Cơ xương khớp", cat: "Bệnh cơ xương",
      symptoms: "Đau khớp gối khi vận động, cứng khớp buổi sáng, tiếng lạo xạo khi cử động",
      description: "Thoái hóa sụn khớp gối do tuổi tác và tải trọng cơ thể.",
      homeTreatment: "Giảm cân, tập bơi lội hoặc xe đạp, chườm ấm, tránh đứng lâu" },
    { name: "Viêm xoang mạn tính", spec: "Nội tổng hợp", cat: "Bệnh nhi khoa",
      symptoms: "Nghẹt mũi, chảy dịch mũi sau, đau nhức quanh mắt và trán, mất mùi",
      description: "Viêm niêm mạc xoang kéo dài trên 12 tuần.",
      homeTreatment: "Rửa mũi bằng nước muối sinh lý, xông hơi, tránh khói bụi" },
    { name: "Hen suyễn", spec: "Nội tổng hợp", cat: "Bệnh nhi khoa",
      symptoms: "Khó thở, thở khò khè, ho nhiều về đêm và sáng sớm, tức ngực",
      description: "Bệnh viêm mãn tính đường thở gây co thắt và phù nề phế quản.",
      homeTreatment: "Tránh dị nguyên, không hút thuốc, giữ ẩm nhà cửa, dùng thuốc xịt đúng cách" },
  ];

  let count = 0;
  for (const d of data) {
    const existing = await prisma.disease.findFirst({ where: { name: d.name } });
    if (!existing) {
      await prisma.disease.create({
        data: {
          name: d.name,
          nameClean: d.name.toLowerCase(),
          specialtyId: specIds[d.spec] || null,
          categoryId: catIds[d.cat] || null,
          symptoms: d.symptoms,
          description: d.description,
          homeTreatment: d.homeTreatment,
        },
      });
      count++;
    }
  }
  console.log(`✅ Diseases seeded: ${count} mới (${data.length - count} đã tồn tại)`);
}

async function seedMedicines(medTypeIds) {
  const data = [
    { name: "Amlodipine 5mg", type: "Thuốc uống",
      ingredients: "Amlodipine besilate 6.944mg (tương đương Amlodipine 5mg)",
      dosage: "1 viên/ngày, uống buổi sáng",
      usageInstruction: "Uống nguyên viên với nước, không nhai hoặc bẻ đôi. Dùng lúc no hoặc đói đều được.",
      sideEffects: "Phù mắt cá chân, đỏ bừng mặt, nhịp tim nhanh, chóng mặt, đau đầu" },
    { name: "Metformin 500mg", type: "Thuốc uống",
      ingredients: "Metformin hydrochloride 500mg",
      dosage: "1-2 viên/ngày, uống trong bữa ăn",
      usageInstruction: "Uống cùng bữa ăn để giảm tác dụng phụ tiêu hóa. Bắt đầu liều thấp và tăng dần.",
      sideEffects: "Buồn nôn, tiêu chảy, đau bụng, vị kim loại trong miệng (thường hết sau vài tuần)" },
    { name: "Omeprazole 20mg", type: "Thuốc uống",
      ingredients: "Omeprazole 20mg dạng vi hạt bào chế chậm",
      dosage: "1 viên/ngày, uống trước bữa sáng 30 phút",
      usageInstruction: "Nuốt nguyên viên, không nhai. Uống 30 phút trước bữa ăn đầu tiên trong ngày.",
      sideEffects: "Đau đầu, tiêu chảy, buồn nôn, đầy hơi, táo bón" },
    { name: "Loratadine 10mg", type: "Thuốc uống",
      ingredients: "Loratadine 10mg",
      dosage: "1 viên/ngày, có thể uống sáng hoặc tối",
      usageInstruction: "Uống với nước, có thể uống lúc đói hoặc no. Thuốc ít gây buồn ngủ.",
      sideEffects: "Đau đầu nhẹ, khô miệng, mệt mỏi (hiếm gặp)" },
    { name: "Ibuprofen 400mg", type: "Thuốc uống",
      ingredients: "Ibuprofen 400mg",
      dosage: "1 viên mỗi 6-8 giờ, không quá 3 viên/ngày",
      usageInstruction: "Uống sau bữa ăn hoặc cùng sữa để giảm kích ứng dạ dày. Không dùng quá 5 ngày.",
      sideEffects: "Kích ứng dạ dày, buồn nôn, chóng mặt, tăng huyết áp nếu dùng dài ngày" },
    { name: "Paracetamol 500mg", type: "Thuốc uống",
      ingredients: "Paracetamol (Acetaminophen) 500mg",
      dosage: "1-2 viên mỗi 4-6 giờ khi cần, không quá 8 viên/ngày",
      usageInstruction: "Uống với nước. Không dùng quá 4g/ngày. Tránh kết hợp với rượu bia.",
      sideEffects: "An toàn khi dùng đúng liều. Quá liều gây độc gan nghiêm trọng" },
    { name: "Betamethasone cream 0.1%", type: "Thuốc bôi",
      ingredients: "Betamethasone valerate 0.1% w/w",
      dosage: "Bôi mỏng vùng tổn thương 1-2 lần/ngày",
      usageInstruction: "Rửa sạch và lau khô vùng da cần điều trị trước khi bôi. Không bôi lên mặt và vùng nếp gấp lâu ngày.",
      sideEffects: "Mỏng da, rạn da, giãn mao mạch nếu dùng lâu dài" },
    { name: "Glucosamine 1500mg", type: "Thuốc uống",
      ingredients: "Glucosamine sulfate 1500mg",
      dosage: "1 gói/ngày, hòa tan với nước uống trong bữa ăn",
      usageInstruction: "Hòa với 200ml nước, uống trong hoặc sau bữa ăn. Cần dùng ít nhất 3 tháng để thấy hiệu quả.",
      sideEffects: "Buồn nôn nhẹ, đầy hơi, tiêu chảy (hiếm gặp)" },
  ];

  let count = 0;
  for (const m of data) {
    const existing = await prisma.medicine.findFirst({ where: { name: m.name } });
    if (!existing) {
      await prisma.medicine.create({
        data: {
          name: m.name,
          typeId: medTypeIds[m.type] || null,
          ingredients: m.ingredients,
          dosage: m.dosage,
          usageInstruction: m.usageInstruction,
          sideEffects: m.sideEffects,
        },
      });
      count++;
    }
  }
  console.log(`✅ Medicines seeded: ${count} mới (${data.length - count} đã tồn tại)`);
}

async function seedDoctors(specIds, degreeIds) {
  const data = [
    { fullName: "Nguyễn Văn An", phone: "0900000001", email: "nguyenvanan@medicare.vn",
      spec: "Tim mạch", degree: "Giáo sư - Tiến sĩ",
      experience: "25 năm kinh nghiệm điều trị bệnh tim mạch, từng công tác tại Viện Tim TP.HCM",
      education: "Tốt nghiệp ĐH Y Hà Nội, Tiến sĩ tại Đại học Tokyo Nhật Bản" },
    { fullName: "Trần Thị Bình", phone: "0900000002", email: "tranthihinh@medicare.vn",
      spec: "Nhi khoa", degree: "Tiến sĩ",
      experience: "18 năm chuyên khám và điều trị bệnh trẻ em, đặc biệt bệnh hô hấp nhi",
      education: "ĐH Y Dược TP.HCM, Thạc sĩ Nhi khoa tại Pháp" },
    { fullName: "Lê Hoàng Cường", phone: "0900000003", email: "lehoangcuong@medicare.vn",
      spec: "Nội tổng hợp", degree: "Bác sĩ CKI",
      experience: "15 năm khám bệnh nội khoa tổng quát, chuyên điều trị đái tháo đường và tăng huyết áp",
      education: "ĐH Y Hà Nội, Chuyên khoa I Nội tổng hợp" },
    { fullName: "Phạm Minh Đức", phone: "0900000004", email: "phamminhduc@medicare.vn",
      spec: "Da liễu", degree: "Thạc sĩ",
      experience: "12 năm điều trị bệnh da liễu, dị ứng và thẩm mỹ da",
      education: "ĐH Y Hà Nội, Thạc sĩ Da liễu tại Hàn Quốc" },
    { fullName: "Hoàng Thu Hà", phone: "0900000005", email: "hoangtuha@medicare.vn",
      spec: "Thần kinh", degree: "Tiến sĩ",
      experience: "20 năm nghiên cứu và điều trị bệnh thần kinh, đặc biệt đột quỵ và Parkinson",
      education: "ĐH Y Dược TP.HCM, Tiến sĩ Thần kinh tại Đức" },
    { fullName: "Vũ Quốc Hùng", phone: "0900000006", email: "vuquochung@medicare.vn",
      spec: "Cơ xương khớp", degree: "Bác sĩ CKI",
      experience: "14 năm phẫu thuật và điều trị bệnh cơ xương khớp, chuyên ghép khớp háng và gối",
      education: "ĐH Y Hà Nội, Chuyên khoa I Chấn thương Chỉnh hình" },
    { fullName: "Đặng Lan Hương", phone: "0900000007", email: "danglanuong@medicare.vn",
      spec: "Sản phụ khoa", degree: "Giáo sư - Tiến sĩ",
      experience: "28 năm trong lĩnh vực sản phụ khoa, chuyên IVF và phẫu thuật nội soi phụ khoa",
      education: "ĐH Y Hà Nội, GS.TS tại Bỉ và Australia" },
    { fullName: "Bùi Xuân Khoa", phone: "0900000008", email: "buixuankhoa@medicare.vn",
      spec: "Tiêu hóa", degree: "Thạc sĩ",
      experience: "10 năm nội soi tiêu hóa, điều trị viêm loét dạ dày và bệnh gan mật",
      education: "ĐH Y Dược TP.HCM, Thạc sĩ Tiêu hóa" },
  ];

  let count = 0;
  for (const d of data) {
    const existing = await prisma.profile.findFirst({ where: { phone: d.phone } });
    if (existing) { continue; }

    const profile = await prisma.profile.create({
      data: {
        fullName: d.fullName,
        phone: d.phone,
        email: d.email,
        role: "DOCTOR",
        isActive: true,
      },
    });

    await prisma.doctor.create({
      data: {
        id: profile.id,
        specialtyId: specIds[d.spec] || null,
        degreeId: degreeIds[d.degree] || null,
        experience: d.experience,
        education: d.education,
      },
    });
    count++;
  }
  console.log(`✅ Doctors seeded: ${count} mới (${data.length - count} đã tồn tại)`);
}

// ── Reindex (chunk + embed) ──────────────────────────────────────────────────
async function reindex() {
  console.log("\n🔄 Bắt đầu reindex chunks & embeddings...");

  const diseases = await prisma.disease.findMany();
  for (const d of diseases) {
    try {
      const res = await axios.post(`${AI_URL}/ai/disease`, {
        content: d.symptoms + " " + (d.description || "")
      });
      const chunks = res.data?.chunks;
      if (chunks?.length) {
        await prisma.$executeRaw`DELETE FROM disease_chunks WHERE disease_id = ${d.id}::uuid`;
        for (const c of chunks) {
          const vec = `[${c.vector.join(",")}]`;
          await prisma.$executeRaw`INSERT INTO disease_chunks (id, disease_id, content, embedding) VALUES (gen_random_uuid(), ${d.id}::uuid, ${c.content}, ${vec}::vector)`;
        }
        console.log(`  ✅ Disease "${d.name}" → ${chunks.length} chunks`);
      }
    } catch (e) {
      console.error(`  ❌ Disease "${d.name}": ${e.response?.data?.detail || e.message}`);
    }
  }

  const medicines = await prisma.medicine.findMany();
  for (const m of medicines) {
    try {
      const res = await axios.post(`${AI_URL}/ai/disease/medicine`, {
        name: m.name,
        ingredients: m.ingredients || "",
        usage: m.usageInstruction || "",
        side_effects: m.sideEffects || ""
      });
      const chunks = res.data?.chunks;
      if (chunks?.length) {
        await prisma.$executeRaw`DELETE FROM medicine_chunks WHERE medicine_id = ${m.id}::uuid`;
        for (const c of chunks) {
          const vec = `[${c.vector.join(",")}]`;
          await prisma.$executeRaw`INSERT INTO medicine_chunks (id, medicine_id, content, embedding) VALUES (gen_random_uuid(), ${m.id}::uuid, ${c.content}, ${vec}::vector)`;
        }
        console.log(`  ✅ Medicine "${m.name}" → ${chunks.length} chunks`);
      }
    } catch (e) {
      console.error(`  ❌ Medicine "${m.name}": ${e.response?.data?.detail || e.message}`);
    }
  }

  const doctors = await prisma.doctor.findMany({ include: { profile: true, specialty: true } });
  for (const doc of doctors) {
    try {
      const res = await axios.post(`${AI_URL}/ai/disease/doctor`, {
        name: doc.profile.fullName,
        specialty: doc.specialty?.name || "Y tế",
        experience: doc.experience || "",
        education: doc.education || ""
      });
      const chunks = res.data?.chunks;
      if (chunks?.length) {
        await prisma.$executeRaw`DELETE FROM doctor_chunks WHERE doctor_id = ${doc.id}::uuid`;
        for (const c of chunks) {
          const vec = `[${c.vector.join(",")}]`;
          await prisma.$executeRaw`INSERT INTO doctor_chunks (id, doctor_id, content, embedding) VALUES (gen_random_uuid(), ${doc.id}::uuid, ${c.content}, ${vec}::vector)`;
        }
        console.log(`  ✅ Doctor "${doc.profile.fullName}" → ${chunks.length} chunks`);
      }
    } catch (e) {
      console.error(`  ❌ Doctor "${doc.profile.fullName}": ${e.message}`);
    }
  }
  console.log("✨ Reindex hoàn tất!");
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Bắt đầu seed dữ liệu...\n");

  const specIds    = await upsertSpecialties();
  const catIds     = await upsertCategories();
  const medTypeIds = await upsertMedTypes();
  const degreeIds  = await upsertDegrees();

  await seedDiseases(specIds, catIds);
  await seedMedicines(medTypeIds);
  await seedDoctors(specIds, degreeIds);

  await reindex();

  process.exit(0);
}

main().catch(e => { console.error("🔥 Lỗi:", e); process.exit(1); });
