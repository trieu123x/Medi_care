import "dotenv/config";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "crypto";

const { PrismaClient } = pkg;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const generateUUID = () => crypto.randomUUID();
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ===================== DỮ LIỆU CHUYÊN KHOA =====================
const SPECIALTIES = [
  { name: "Nội tổng quát", basePrice: 200000, description: "Nội khoa - Nội tổng quát. Rất phổ biến." },
  { name: "Ngoại tổng quát", basePrice: 250000, description: "Ngoại khoa - Ngoại tổng quát." },
  { name: "Nam khoa", basePrice: 300000, description: "Ngoại khoa - Nam khoa. Điều trị yếu sinh lý, rối loạn cương, vô sinh nam." },
  { name: "Sản phụ khoa", basePrice: 250000, description: "Sản phụ khoa. Một trong những khoa đông nhất." },
  { name: "Tai mũi họng", basePrice: 200000, description: "Chuyên khoa Tai mũi họng." },
  { name: "Răng hàm mặt", basePrice: 200000, description: "Chuyên khoa Răng hàm mặt." },
  { name: "Nhãn khoa", basePrice: 200000, description: "Chuyên khoa Mắt (Nhãn khoa)." },
  { name: "Tiết niệu", basePrice: 250000, description: "Chuyên khoa Tiết niệu." },
  { name: "Ung bướu", basePrice: 500000, description: "Chuyên khoa Ung bướu." },
  { name: "Phục hồi chức năng", basePrice: 200000, description: "Chuyên khoa Phục hồi chức năng." },
  { name: "Tâm thần", basePrice: 250000, description: "Chuyên khoa Tâm thần / Tâm lý." },
  { name: "Dị ứng miễn dịch", basePrice: 200000, description: "Chuyên khoa Dị ứng - Miễn dịch." },
];

// ===================== BỆNH THEO CHUYÊN KHOA =====================
const DISEASES_BY_SPECIALTY = {
  "Nội tổng quát": [
    { name: "Cảm cúm", symptoms: "Sốt, đau đầu, mệt mỏi, sổ mũi, đau họng", description: "Nhiễm trùng đường hô hấp do virus cúm.", homeTreatment: "Nghỉ ngơi, uống nước ấm, súc miệng nước muối." },
    { name: "Cao huyết áp", symptoms: "Đau đầu vùng gáy, hoa mắt, ù tai, mệt mỏi", description: "Áp lực máu lên thành mạch liên tục cao ≥140/90 mmHg.", homeTreatment: "Giảm muối, tập thể dục, kiểm soát stress." },
    { name: "Tiểu đường type 2", symptoms: "Khát nước, tiểu nhiều, mệt mỏi, vết thương lâu lành", description: "Rối loạn chuyển hóa đường do kháng insulin.", homeTreatment: "Kiểm soát chế độ ăn ít đường, tập thể dục." },
  ],
  "Ngoại tổng quát": [
    { name: "Viêm ruột thừa", symptoms: "Đau bụng dưới phải, sốt, buồn nôn, nôn", description: "Viêm nhiễm ruột thừa cần xử trí ngoại khoa.", homeTreatment: "Cần đến bệnh viện ngay, không tự điều trị tại nhà." },
    { name: "Thoát vị bẹn", symptoms: "Khối phồng ở vùng bẹn, đau khi gắng sức hoặc ho", description: "Tạng bụng chui qua lỗ bẹn ra ngoài.", homeTreatment: "Tránh mang vác nặng, cần phẫu thuật." },
    { name: "Sỏi mật", symptoms: "Đau quặn hạ sườn phải, vàng da, buồn nôn sau ăn mỡ", description: "Sự hình thành sỏi trong túi mật hoặc ống mật.", homeTreatment: "Ăn ít chất béo, uống nhiều nước." },
  ],
  "Nam khoa": [
    { name: "Rối loạn cương dương", symptoms: "Không đạt hoặc duy trì cương cứng, giảm ham muốn", description: "Rối loạn chức năng tình dục ở nam giới.", homeTreatment: "Giảm stress, tập thể dục, hạn chế rượu bia." },
    { name: "Vô sinh nam", symptoms: "Không có con sau 1 năm quan hệ không dùng biện pháp tránh thai", description: "Giảm số lượng hoặc chất lượng tinh trùng.", homeTreatment: "Tránh nhiệt độ cao vùng tinh hoàn, ăn uống đủ dinh dưỡng." },
    { name: "Viêm tiền liệt tuyến", symptoms: "Tiểu buốt, tiểu rắt, đau vùng đáy chậu, sốt", description: "Viêm nhiễm tuyến tiền liệt do vi khuẩn hoặc không do vi khuẩn.", homeTreatment: "Tắm nước ấm, uống nhiều nước, tránh đồ cay." },
  ],
  "Sản phụ khoa": [
    { name: "Viêm âm đạo", symptoms: "Ngứa, rát, khí hư bất thường, mùi hôi", description: "Viêm niêm mạc âm đạo do vi khuẩn hoặc nấm.", homeTreatment: "Vệ sinh đúng cách, mặc đồ lót thoáng, tránh thụt rửa sâu." },
    { name: "Rối loạn kinh nguyệt", symptoms: "Kinh nguyệt không đều, đau bụng kinh, ra nhiều hoặc ít", description: "Mất cân bằng nội tiết tố nữ gây rối loạn chu kỳ kinh.", homeTreatment: "Giữ cân nặng ổn định, giảm stress, ngủ đủ giấc." },
    { name: "U xơ tử cung", symptoms: "Đau bụng dưới, kinh nhiều, tiểu khó nếu u lớn", description: "Khối u lành tính phát triển trong thành tử cung.", homeTreatment: "Theo dõi định kỳ, hạn chế thực phẩm nhiều estrogen." },
  ],
  "Tai mũi họng": [
    { name: "Viêm xoang", symptoms: "Nghẹt mũi, chảy dịch đặc, đau vùng mặt, đau đầu", description: "Viêm niêm mạc xoang mũi do nhiễm trùng hoặc dị ứng.", homeTreatment: "Rửa mũi nước muối, xông hơi, uống nhiều nước." },
    { name: "Viêm amidan mãn tính", symptoms: "Đau họng tái đi tái lại, nuốt đau, hơi thở hôi, sốt", description: "Viêm nhiễm mãn tính tại amidan.", homeTreatment: "Súc họng nước muối ấm, uống nhiều nước, tránh lạnh." },
    { name: "Điếc tiếp âm", symptoms: "Nghe kém, ù tai, khó nghe tiếng nói", description: "Suy giảm thính lực do tổn thương tế bào lông ở tai trong.", homeTreatment: "Tránh tiếng ồn lớn, không ngoáy tai bằng tăm bông." },
  ],
  "Răng hàm mặt": [
    { name: "Sâu răng", symptoms: "Đau răng, ê buốt khi ăn đồ ngọt hoặc lạnh nóng", description: "Phá hủy men và ngà răng do vi khuẩn sản xuất acid.", homeTreatment: "Chải răng 2 lần/ngày, dùng chỉ nha khoa, hạn chế đồ ngọt." },
    { name: "Viêm nướu", symptoms: "Nướu đỏ, sưng, chảy máu khi chải răng", description: "Viêm nhiễm mô nướu xung quanh răng do mảng bám.", homeTreatment: "Chải răng đúng cách, súc miệng nước muối, cạo vôi định kỳ." },
    { name: "Lệch khớp cắn", symptoms: "Khó khăn khi nhai, đau hàm, mòn răng không đều", description: "Răng hàm trên và dưới không khớp đúng vị trí.", homeTreatment: "Tránh nhai một bên, tập thư giãn cơ hàm." },
  ],
  "Nhãn khoa": [
    { name: "Cận thị", symptoms: "Nhìn mờ xa, nheo mắt, đau đầu khi nhìn xa", description: "Trục nhãn cầu dài hơn bình thường làm ảnh hội tụ trước võng mạc.", homeTreatment: "Nghỉ ngơi mắt thường xuyên, ngồi đúng khoảng cách." },
    { name: "Đục thủy tinh thể", symptoms: "Nhìn mờ dần, chói sáng, nhìn đôi, nhìn mờ ban đêm", description: "Thủy tinh thể trở nên đục mờ theo tuổi hoặc bệnh lý.", homeTreatment: "Đeo kính phù hợp, tránh UV, ăn rau xanh nhiều." },
    { name: "Viêm kết mạc", symptoms: "Mắt đỏ, ngứa, chảy nước mắt, ghèn nhiều", description: "Viêm màng kết mạc do vi khuẩn, virus hoặc dị ứng.", homeTreatment: "Chườm mắt nước ấm, không dụi mắt, rửa tay thường xuyên." },
  ],
  "Tiết niệu": [
    { name: "Sỏi thận", symptoms: "Đau quặn lưng lan xuống bẹn, tiểu buốt, nước tiểu có máu", description: "Tinh thể khoáng chất tích tụ trong thận.", homeTreatment: "Uống 2-3 lít nước/ngày, hạn chế muối và oxalat." },
    { name: "Nhiễm trùng đường tiểu", symptoms: "Tiểu buốt, tiểu rắt, nước tiểu đục hoặc có máu, sốt", description: "Vi khuẩn xâm nhập và gây viêm đường tiết niệu.", homeTreatment: "Uống nhiều nước, uống nước nam việt quất, vệ sinh đúng cách." },
    { name: "Phì đại tiền liệt tuyến", symptoms: "Tiểu khó, tiểu đêm nhiều lần, tia tiểu yếu", description: "Tuyến tiền liệt phì đại theo tuổi gây tắc nghẽn đường tiểu.", homeTreatment: "Hạn chế cà phê và rượu bia, tránh nhịn tiểu lâu." },
  ],
  "Ung bướu": [
    { name: "Ung thư phổi", symptoms: "Ho kéo dài, ho ra máu, khó thở, đau ngực, gầy sút cân", description: "Ung thư phát sinh từ tế bào phổi, liên quan nhiều đến hút thuốc lá.", homeTreatment: "Bỏ thuốc lá ngay, ăn nhiều rau quả, tránh khói bụi ô nhiễm." },
    { name: "Ung thư đại tràng", symptoms: "Thay đổi thói quen đại tiện, phân có máu, đau bụng, mệt mỏi", description: "Ung thư phát sinh trong niêm mạc đại tràng hoặc trực tràng.", homeTreatment: "Ăn nhiều chất xơ, hạn chế thịt đỏ và thịt chế biến, tập thể dục." },
    { name: "Ung thư vú", symptoms: "Khối cứng trong vú, thay đổi hình dạng vú, tiết dịch núm vú", description: "Ung thư phổ biến nhất ở phụ nữ, phát sinh từ tế bào tuyến vú.", homeTreatment: "Tự khám vú định kỳ, tầm soát mammography, duy trì cân nặng hợp lý." },
  ],
  "Phục hồi chức năng": [
    { name: "Liệt nửa người sau đột quỵ", symptoms: "Yếu hoặc liệt một bên người, khó nói, khó nuốt", description: "Di chứng thần kinh sau đột quỵ não cần phục hồi chức năng.", homeTreatment: "Tập vận động sớm, luyện ngôn ngữ, vật lý trị liệu hàng ngày." },
    { name: "Đau vai cổ mãn tính", symptoms: "Đau cứng vùng cổ vai, tê bì tay, hạn chế xoay cổ", description: "Đau cơ và cột sống vùng cổ vai do tư thế sai hoặc thoái hóa.", homeTreatment: "Sửa tư thế ngồi, tập giãn cơ cổ vai, chườm nóng." },
    { name: "Hội chứng ống cổ tay", symptoms: "Tê bì ngón tay (ngón 1-3), đau tay về đêm, yếu cơ ngón cái", description: "Chèn ép dây thần kinh giữa tại ống cổ tay.", homeTreatment: "Nẹp cổ tay khi ngủ, nghỉ ngơi tay, tập bài giãn cơ." },
  ],
  "Tâm thần": [
    { name: "Trầm cảm", symptoms: "Buồn bã kéo dài, mất hứng thú, mệt mỏi, rối loạn giấc ngủ, suy nghĩ tiêu cực", description: "Rối loạn tâm thần phổ biến gây sụt giảm chất lượng cuộc sống.", homeTreatment: "Tập thể dục, duy trì kết nối xã hội, thiền định, ngủ đủ giấc." },
    { name: "Rối loạn lo âu", symptoms: "Lo lắng quá mức, tim đập nhanh, đổ mồ hôi, căng thẳng không rõ nguyên nhân", description: "Trạng thái lo âu kéo dài và quá mức so với tình huống thực tế.", homeTreatment: "Hít thở sâu, thiền mindfulness, hạn chế caffeine." },
    { name: "Mất ngủ mãn tính", symptoms: "Khó vào giấc, thức đêm nhiều lần, dậy sớm, mệt mỏi ban ngày", description: "Rối loạn giấc ngủ kéo dài trên 3 tháng.", homeTreatment: "Ngủ đúng giờ, tránh màn hình trước ngủ, uống trà hoa cúc." },
  ],
  "Dị ứng miễn dịch": [
    { name: "Dị ứng thức ăn", symptoms: "Nổi mề đay, ngứa, sưng môi/lưỡi, khó thở sau ăn", description: "Phản ứng miễn dịch quá mức với các protein trong thức ăn.", homeTreatment: "Xác định và tránh thức ăn gây dị ứng, mang theo thuốc kháng histamin." },
    { name: "Viêm mũi dị ứng", symptoms: "Hắt xì hơi liên tục, chảy mũi trong, ngứa mắt mũi, nghẹt mũi", description: "Phản ứng dị ứng ở niêm mạc mũi với phấn hoa, bụi, lông thú.", homeTreatment: "Tránh dị nguyên, rửa mũi nước muối, đeo khẩu trang." },
    { name: "Lupus ban đỏ", symptoms: "Phát ban hình cánh bướm mặt, đau khớp, mệt mỏi, nhạy cảm với ánh nắng", description: "Bệnh tự miễn hệ thống tấn công nhiều cơ quan trong cơ thể.", homeTreatment: "Tránh nắng, dùng kem chống nắng, nghỉ ngơi đủ giấc." },
  ],
};

// ===================== DỮ LIỆU BÁC SĨ =====================
const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Hồ"];
const TEN_DEM = ["Văn", "Thị", "Minh", "Ngọc", "Hải", "Tuấn", "Thanh", "Bảo", "Đức", "Quốc"];
const TEN = ["Anh", "Nam", "Trang", "Dũng", "Đạt", "Hà", "Hương", "Khang", "Tâm", "Sơn"];
const randomName = () => `${getRandom(HO)} ${getRandom(TEN_DEM)} ${getRandom(TEN)}`;

const DEGREES = ["BSCK I", "BSCK II", "Thạc sĩ", "Tiến sĩ", "Phó Giáo sư"];
const SCHOOLS = [
  "Đại học Y Hà Nội", "Đại học Y Dược TP.HCM",
  "Đại học Y Dược Huế", "Đại học Y khoa Phạm Ngọc Thạch",
  "Học viện Quân Y"
];
const ACHIEVEMENTS = [
  "Giải thưởng Thầy thuốc trẻ tiêu biểu 2023",
  "Bằng khen Bộ Y tế về thành tích chuyên môn",
  "Chứng chỉ đào tạo chuyên sâu tại Nhật Bản",
  null
];

// ===================== MAIN =====================
async function main() {
  console.log("🚀 Bắt đầu seed chuyên khoa, bệnh và bác sĩ...");

  // 1. Lấy danh mục bệnh hiện có (dùng lại)
  let categories = await prisma.diseaseCategory.findMany();
  if (categories.length === 0) {
    const catNames = ["Nội khoa", "Ngoại khoa", "Phụ khoa", "Tai mũi họng", "Răng miệng", "Mắt", "Tiết niệu", "Ung bướu", "Thần kinh", "Dị ứng"];
    for (const name of catNames) {
      const cat = await prisma.diseaseCategory.create({ data: { name, description: `Nhóm bệnh ${name}` } });
      categories.push(cat);
    }
  }

  // 2. Lấy/tạo loại thuốc mặc định
  let medicineTypes = await prisma.medicineType.findMany();
  if (medicineTypes.length === 0) {
    const mt = await prisma.medicineType.create({ data: { name: "Thuốc uống", description: "Thuốc dùng đường uống" } });
    medicineTypes.push(mt);
  }

  // 3. Lấy bằng cấp hiện có hoặc tạo mới
  let degrees = await prisma.degree.findMany();
  if (degrees.length === 0) {
    for (let i = 0; i < DEGREES.length; i++) {
      const d = await prisma.degree.create({ data: { name: DEGREES[i], description: DEGREES[i], rankWeight: (5 - i) * 10 } });
      degrees.push(d);
    }
  }

  // 4. Tạo chuyên khoa
  const createdSpecialties = [];
  for (const sp of SPECIALTIES) {
    const existing = await prisma.specialty.findFirst({ where: { name: sp.name } });
    if (existing) {
      createdSpecialties.push(existing);
      console.log(`  ⏭️  Bỏ qua chuyên khoa đã có: ${sp.name}`);
    } else {
      const created = await prisma.specialty.create({ data: sp });
      createdSpecialties.push(created);
      console.log(`  ✅ Tạo chuyên khoa: ${sp.name}`);
    }
  }

  // 5. Tạo bệnh cho từng chuyên khoa
  console.log("\n🏥 Đang tạo bệnh...");
  for (const sp of createdSpecialties) {
    const diseases = DISEASES_BY_SPECIALTY[sp.name];
    if (!diseases) continue;
    for (const d of diseases) {
      const existing = await prisma.disease.findFirst({ where: { name: d.name } });
      if (existing) {
        console.log(`  ⏭️  Bỏ qua bệnh đã có: ${d.name}`);
      } else {
        await prisma.disease.create({
          data: {
            id: generateUUID(),
            name: d.name,
            categoryId: getRandom(categories).id,
            specialtyId: sp.id,
            description: d.description,
            symptoms: d.symptoms,
            homeTreatment: d.homeTreatment,
          }
        });
        console.log(`  ✅ Tạo bệnh: ${d.name} (${sp.name})`);
      }
    }
  }

  // 6. Tạo bác sĩ (2-3 bác sĩ mỗi chuyên khoa)
  console.log("\n👨‍⚕️ Đang tạo bác sĩ...");
  let doctorCount = 0;
  for (const sp of createdSpecialties) {
    const numDoctors = getRandomInt(2, 3);
    for (let i = 0; i < numDoctors; i++) {
      doctorCount++;
      const name = randomName();
      const degree = getRandom(degrees);
      const phone = `097${getRandomInt(1000000, 9999999)}`;
      const email = `dr.${name.toLowerCase().replace(/\s+/g, "").replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e").replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o").replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y").replace(/đ/g, "d")}_${doctorCount}@hospital.vn`;

      const profile = await prisma.profile.create({
        data: {
          id: generateUUID(),
          fullName: name,
          phone,
          role: "DOCTOR",
          email,
        }
      });

      await prisma.doctor.create({
        data: {
          id: profile.id,
          specialtyId: sp.id,
          degreeId: degree.id,
          experience: `${getRandomInt(5, 20)} năm kinh nghiệm tại các bệnh viện tuyến trung ương`,
          education: getRandom(SCHOOLS),
          achievements: getRandom(ACHIEVEMENTS),
        }
      });

      console.log(`  ✅ Bác sĩ ${name} (${degree.name} - ${sp.name})`);
    }
  }

  console.log("\n==================================================");
  console.log(`🎉 HOÀN TẤT! Đã tạo:`);
  console.log(`   - ${createdSpecialties.length} chuyên khoa`);
  console.log(`   - ${Object.values(DISEASES_BY_SPECIALTY).flat().length} bệnh`);
  console.log(`   - ${doctorCount} bác sĩ`);
  console.log("==================================================");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
