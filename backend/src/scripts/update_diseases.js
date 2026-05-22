import "dotenv/config";
import { prisma } from "../configs/prisma-config.js";
import axios from "axios";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const UPDATES = [
  {
    name: "Tăng huyết áp",
    symptoms: "Đau đầu vùng chẩm, chóng mặt, hoa mắt, ù tai, huyết áp cao trên 140/90 mmHg, đau đầu buổi sáng, đỏ mặt, mờ mắt, khó thở khi gắng sức, tim đập mạnh, chảy máu cam.",
    description: "Tăng huyết áp (cao huyết áp, hypertension) là bệnh mạn tính khi áp lực máu trong động mạch liên tục cao hơn bình thường. Nguyên nhân gồm béo phì, ăn nhiều muối, ít vận động, căng thẳng, di truyền, đái tháo đường, bệnh thận. Tăng huyết áp là yếu tố nguy cơ hàng đầu gây đột quỵ, nhồi máu cơ tim, suy thận, suy tim. Phân loại: độ 1 (140-159/90-99), độ 2 (≥160/100). Nhiều bệnh nhân không có triệu chứng nên còn gọi là sát thủ thầm lặng.",
    homeTreatment: "Giảm muối dưới 5g/ngày, tập thể dục aerobic 30 phút/ngày 5 ngày/tuần, bỏ thuốc lá, hạn chế rượu bia, giảm cân về BMI dưới 25, ăn nhiều rau quả, đo huyết áp tại nhà thường xuyên."
  },
  {
    name: "Nhồi máu cơ tim",
    symptoms: "Đau ngực dữ dội như bị đè ép hoặc bóp nghẹt, đau lan ra cánh tay trái, vai, hàm, cổ, lưng, buồn nôn, nôn mửa, vã mồ hôi lạnh, khó thở, hồi hộp, choáng váng, ngất xỉu, da tái nhợt.",
    description: "Nhồi máu cơ tim (heart attack, STEMI/NSTEMI) xảy ra khi mảng xơ vữa động mạch vành bị vỡ, hình thành cục máu đông làm tắc hoàn toàn hoặc một phần dòng máu nuôi cơ tim, gây hoại tử tế bào cơ tim. Đây là cấp cứu tim mạch nguy hiểm tính mạng. Yếu tố nguy cơ: hút thuốc lá, tăng huyết áp, tiểu đường, mỡ máu cao, béo phì, ít vận động, gia đình có tiền sử bệnh tim.",
    homeTreatment: "GỌI CẤP CỨU 115 NGAY LẬP TỨC. Nằm nghỉ, nới lỏng quần áo, nhai 1 viên Aspirin 325mg nếu có. Không tự lái xe đến bệnh viện. Thời gian vàng điều trị là 90 phút đầu."
  },
  {
    name: "Tiểu đường type 2",
    symptoms: "Khát nước liên tục, tiểu nhiều lần kể cả ban đêm, mệt mỏi uể oải, mờ mắt, vết thương lâu lành, ngứa ngoài da, tê bì chân tay, nhiễm trùng tái phát, sụt cân không rõ nguyên nhân, đói liên tục dù đã ăn.",
    description: "Đái tháo đường type 2 (tiểu đường, diabetes mellitus type 2) là rối loạn chuyển hóa mạn tính do kháng insulin và suy giảm chức năng tế bào beta tụy, khiến đường huyết tăng cao. Xét nghiệm chẩn đoán: HbA1c ≥6.5%, đường huyết đói ≥126mg/dL, đường huyết ngẫu nhiên ≥200mg/dL. Biến chứng: bệnh thận, mù mắt, cắt cụt chi, đột quỵ, nhồi máu cơ tim. Yếu tố nguy cơ: béo phì vùng bụng, ít vận động, gia đình có tiền sử, người trên 45 tuổi.",
    homeTreatment: "Chế độ ăn ít đường, ít tinh bột, nhiều rau xanh, kiểm soát khẩu phần ăn. Tập thể dục 150 phút/tuần. Giảm 5-10% cân nặng. Theo dõi đường huyết tại nhà. Uống đủ nước, ngủ đủ giấc."
  },
  {
    name: "Viêm dạ dày",
    symptoms: "Đau hoặc nóng rát vùng thượng vị (trên rốn dưới ngực), buồn nôn, nôn, ợ hơi, ợ chua, chướng bụng, đầy hơi, ăn không ngon miệng, no sớm, đôi khi phân đen hoặc nôn ra máu.",
    description: "Viêm dạ dày (gastritis) là tình trạng viêm, kích ứng hoặc bào mòn lớp niêm mạc dạ dày. Nguyên nhân thường gặp: nhiễm vi khuẩn Helicobacter pylori (H. pylori), sử dụng thuốc kháng viêm NSAID (ibuprofen, aspirin), uống nhiều rượu bia, căng thẳng kéo dài, bệnh tự miễn. Viêm dạ dày mạn tính do H. pylori có thể tiến triển thành loét dạ dày hoặc ung thư dạ dày nếu không điều trị.",
    homeTreatment: "Ăn chín uống sôi, ăn nhiều bữa nhỏ trong ngày, tránh thức ăn cay nóng chua, tránh rượu bia và thuốc lá, không dùng NSAID khi không cần thiết, giảm căng thẳng, uống đủ nước."
  },
  {
    name: "Trào ngược dạ dày thực quản",
    symptoms: "Ợ nóng (cảm giác nóng rát từ dạ dày lên ngực), ợ chua, đau tức sau xương ức, đắng miệng buổi sáng, khó nuốt, nghẹn cổ họng, ho khan mãn tính nhất là về đêm, khàn giọng, hay bị viêm họng tái phát.",
    description: "Trào ngược dạ dày thực quản (GERD - Gastroesophageal Reflux Disease) xảy ra khi cơ vòng thực quản dưới (LES) yếu hoặc giãn bất thường, cho phép acid dạ dày trào ngược lên thực quản, gây kích ứng niêm mạc. Yếu tố làm nặng thêm: béo phì, mang thai, ăn no nằm ngay, thức ăn béo, sô cô la, cà phê, rượu, thuốc lá. Biến chứng: viêm thực quản, Barrett thực quản, ung thư thực quản.",
    homeTreatment: "Kê cao đầu giường 15-20cm, không ăn trước ngủ 3 giờ, ăn từng bữa nhỏ, giảm cân nếu béo phì, tránh cà phê, rượu, sôcôla, thức ăn chua cay, không mặc quần áo bó sát bụng."
  },
  {
    name: "Migraine (Đau nửa đầu)",
    symptoms: "Đau đầu dữ dội một bên đầu (thái dương hoặc trán), đau theo nhịp mạch, kéo dài 4-72 giờ, tăng khi vận động, nhạy cảm với ánh sáng (sợ sáng), tiếng ồn (sợ tiếng), mùi, buồn nôn, nôn. Một số người có aura trước cơn đau: nhìn thấy ánh sáng lóe, điểm mù, tê bì mặt tay.",
    description: "Migraine (đau nửa đầu, đau đầu Migraine) là rối loạn thần kinh mạch máu mạn tính, đặc trưng bởi các cơn đau đầu tái phát. Cơ chế liên quan kích hoạt hệ thần kinh sinh ba và giải phóng chất dẫn truyền thần kinh. Tác nhân khởi phát: stress, thiếu ngủ hoặc ngủ quá nhiều, thay đổi hormone (kinh nguyệt), thay đổi thời tiết, bỏ bữa, ánh sáng mạnh, rượu bia, cà phê. Ảnh hưởng đến 10-15% dân số, phổ biến hơn ở phụ nữ.",
    homeTreatment: "Nghỉ ngơi phòng tối yên tĩnh, chườm lạnh lên trán hoặc cổ gáy, uống nhiều nước, ngủ đủ giấc điều độ, dùng paracetamol hoặc ibuprofen sớm khi cơn bắt đầu, ghi nhật ký cơn đau để tìm tác nhân."
  },
  {
    name: "Mề đay mãn tính",
    symptoms: "Nổi mẩn đỏ hoặc hồng trên da, ngứa dữ dội, ban phù (sần phồng) có thể xuất hiện và biến mất trong vòng 24 giờ, tái phát liên tục trên 6 tuần, có thể kèm phù mạch (sưng môi, mắt, tay chân), đôi khi khó thở nếu ảnh hưởng họng.",
    description: "Mề đay mãn tính (chronic urticaria, dị ứng mẩn ngứa mạn tính) là phản ứng dị ứng da biểu hiện bởi các ban mề đay tái phát kéo dài hơn 6 tuần. Nguyên nhân thường tự phát hoặc do: dị ứng thức ăn (tôm cua, đậu phộng, trứng, sữa), thuốc (penicillin, NSAID), nhiễm trùng, stress, nhiệt độ thay đổi, ánh sáng mặt trời, tự miễn. 50% trường hợp không tìm được nguyên nhân.",
    homeTreatment: "Tránh tác nhân nghi ngờ, mặc quần áo rộng thoáng vải cotton, tắm nước mát, tránh gãi, tránh nhiệt độ cực đoan và stress, ghi nhật ký ăn uống để tìm thức ăn gây dị ứng."
  },
  {
    name: "Thoái hóa khớp gối",
    symptoms: "Đau khớp gối khi đứng lên ngồi xuống, leo cầu thang, đi bộ lâu. Cứng khớp buổi sáng dưới 30 phút. Tiếng lạo xạo, lục cục khi cử động. Sưng khớp nhẹ, hạn chế biên độ vận động. Đau tăng khi thời tiết thay đổi hoặc ẩm ướt. Biến dạng khớp gối giai đoạn nặng.",
    description: "Thoái hóa khớp gối (osteoarthritis gối, viêm xương khớp gối, hư khớp gối) là bệnh khớp mạn tính do thoái hóa sụn khớp và xương dưới sụn, đặc trưng bởi sụn khớp mòn dần, hình thành gai xương. Là nguyên nhân gây đau khớp và tàn phế phổ biến nhất ở người trên 50 tuổi. Yếu tố nguy cơ: tuổi cao, béo phì, chấn thương gối cũ, vận động viên, lao động nặng, phụ nữ sau mãn kinh.",
    homeTreatment: "Giảm cân 1kg giảm 4kg áp lực lên gối. Tập bơi lội, xe đạp, yoga nhẹ. Chườm ấm trước vận động, chườm lạnh sau khi đau. Dùng gậy hỗ trợ. Tránh ngồi xổm, quỳ, leo cầu thang nhiều."
  },
  {
    name: "Viêm xoang mạn tính",
    symptoms: "Nghẹt mũi một hoặc hai bên kéo dài, chảy nước mũi đặc màu vàng xanh, dịch mũi chảy xuống họng (post-nasal drip), đau nhức vùng trán, má, quanh mắt, đau tăng khi cúi đầu, mất hoặc giảm khứu giác, hơi thở có mùi, đau đầu buổi sáng, ho kéo dài, mệt mỏi.",
    description: "Viêm xoang mạn tính (chronic sinusitis, viêm xoang mũi mạn) là tình trạng viêm niêm mạc các xoang cạnh mũi kéo dài trên 12 tuần dù đã điều trị. Nguyên nhân: nhiễm khuẩn, vi rút, nấm, dị ứng, polyp mũi, vẹo vách ngăn, hen suyễn. Xoang thường bị ảnh hưởng: xoang hàm trên, xoang sàng, xoang trán, xoang bướm. Liên quan chặt với viêm mũi dị ứng và hen phế quản.",
    homeTreatment: "Rửa mũi bằng nước muối sinh lý NaCl 0.9% ngày 2-3 lần. Xông hơi mũi. Uống đủ nước. Tránh khói thuốc, bụi, phấn hoa. Dùng máy tạo độ ẩm phòng ngủ. Tránh bơi lội khi đang viêm cấp."
  },
  {
    name: "Hen suyễn",
    symptoms: "Khó thở từng cơn đặc biệt về đêm và sáng sớm, thở khò khè có tiếng rít, ho khan dai dẳng tăng về đêm, tức nặng ngực, khó thở tăng khi tiếp xúc với bụi, phấn hoa, khói, lạnh hoặc vận động. Cơn hen nặng: tím tái, không nói được câu dài, ngực co kéo mạnh.",
    description: "Hen phế quản (hen suyễn, asthma, suyễn) là bệnh viêm mạn tính đường thở làm phế quản nhạy cảm quá mức, gây co thắt, phù nề và tăng tiết nhầy khi tiếp xúc với các kích thích. Là bệnh phổi mạn tính phổ biến nhất ở trẻ em. Tác nhân khởi phát: dị nguyên (bụi mạt nhà, lông thú, phấn hoa, mốc), nhiễm trùng hô hấp, khói thuốc, không khí lạnh, gắng sức, stress, NSAID. Hen không kiểm soát gây suy giảm chức năng phổi dài hạn.",
    homeTreatment: "Tránh tiếp xúc dị nguyên, giặt chăn gối nước nóng 60 độ mỗi tuần, không nuôi thú cưng, dùng máy lọc không khí, tập thở, không hút thuốc, tiêm vaccine cúm hàng năm, luôn mang theo thuốc xịt cắt cơn."
  },
];

async function run() {
  console.log("🔄 Cập nhật mô tả bệnh chi tiết...\n");

  for (const u of UPDATES) {
    const disease = await prisma.disease.findFirst({ where: { name: u.name } });
    if (!disease) { console.warn(`  ⚠️  Không tìm thấy: ${u.name}`); continue; }

    await prisma.disease.update({
      where: { id: disease.id },
      data: { symptoms: u.symptoms, description: u.description, homeTreatment: u.homeTreatment },
    });
    console.log(`  ✅ Đã cập nhật: ${u.name}`);
  }

  console.log("\n🔄 Reindex embeddings...\n");

  const diseases = await prisma.disease.findMany({
    where: { name: { in: UPDATES.map(u => u.name) } }
  });

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
          await prisma.$executeRaw`
            INSERT INTO disease_chunks (id, disease_id, content, embedding)
            VALUES (gen_random_uuid(), ${d.id}::uuid, ${c.content}, ${vec}::vector)
          `;
        }
        console.log(`  ✅ "${d.name}" → ${chunks.length} chunks`);
      }
    } catch (e) {
      console.error(`  ❌ "${d.name}": ${e.response?.data?.detail || e.message}`);
    }
  }

  console.log("\n✨ Hoàn tất!");
  process.exit(0);
}

run().catch(e => { console.error("🔥", e.message); process.exit(1); });
