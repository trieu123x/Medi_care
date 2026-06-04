from app.config.ai_model import ai_provider
from app.config.database import db
from app.services.embedding_vector_service import embedding_service
from enum import Enum
import asyncio
import json
import uuid
import time

class Intent(str, Enum):
    SYMPTOM_INQUIRY = "symptom_inquiry"
    MEDICINE_INQUIRY = "medicine_inquiry"
    DOCTOR_SEARCH = "doctor_search"
    APPOINTMENT_BOOKING = "appointment_booking"
    GENERAL_HEALTH = "general_health"
    EMERGENCY = "emergency"

class RAGService:
    def __init__(self):
        pass

    async def rewrite_query(self, history_text: str, user_input: str) -> str:

        """
        Sử dụng LLM để viết lại câu hỏi của người dùng thành một câu truy vấn độc lập
        dựa trên lịch sử trò chuyện.
        """
        if not history_text:
            return user_input
            
        prompt = (
            f"Lịch sử:\n{history_text}\n\n"
            f"Câu hỏi mới: {user_input}\n\n"
            "Viết lại câu hỏi thành câu truy vấn y khoa độc lập, đầy đủ nghĩa. Chỉ trả về câu truy vấn, không giải thích."
        )
        try:
            rewritten = await ai_provider.generate_short(prompt)
            return rewritten.strip() if rewritten else user_input
        except Exception:
            return user_input
   
    async def classify_intent(self, history_text: str, user_input: str) -> Intent:
        """
        Phân loại ý định của người dùng trước khi truy xuất dữ liệu.
        """
        labels = ", ".join(e.value for e in Intent)
        prompt = (
            f"Phân loại intent câu hỏi y tế sau vào đúng một nhãn: {labels}\n"
            f"Lịch sử:\n{history_text}\n"
            f"Câu hỏi: {user_input}\n"
            "Chỉ trả về tên nhãn, không giải thích."
        )

        try:
            result = await ai_provider.generate_short(prompt)
            intent = result.strip().lower()
            if intent in [e.value for e in Intent]:
                return Intent(intent)
        except Exception:
            pass

        return Intent.GENERAL_HEALTH

    async def build_and_stream(self, session_id: str, user_input: str):
        t_start = time.time()

        # 1. Lấy lịch sử chat
        history_query = """
            SELECT role, content
            FROM chat_messages
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT 6
        """
        try:
            history_rows = await db.fetch(history_query, session_id)
        except Exception as e:
            print(f"[RAG] ⚠️ Không lấy được lịch sử chat: {e}, tiếp tục với lịch sử rỗng")
            history_rows = []
        history = list(reversed(history_rows))
        role_label = {"USER": "Người dùng", "AI": "Trợ lý"}
        history_text = "\n".join(
            f"{role_label.get(row['role'], row['role'])}: {row['content'][:400]}"
            for row in history
        )

        # 2. Rewrite query + classify intent SONG SONG (cả hai dùng generate_short)
        t_parallel = time.time()
        rewrite_result, intent_result = await asyncio.gather(
            self.rewrite_query(history_text, user_input),
            self.classify_intent(history_text, user_input),
            return_exceptions=True
        )
        rewritten_query = rewrite_result if not isinstance(rewrite_result, Exception) else user_input
        intent = intent_result if not isinstance(intent_result, Exception) else Intent.GENERAL_HEALTH
        print(f"[RAG] Intent: {intent} | Rewritten: {rewritten_query!r} | prep: {time.time()-t_parallel:.2f}s")

        # 3. Embed câu đã rewrite (ngữ nghĩa đầy đủ hơn user_input gốc)
        try:
            query_vector = await embedding_service.embed_user_query(rewritten_query)
        except Exception:
            query_vector = [0.0] * 3072
        vector_str = f"[{','.join(map(str, query_vector))}]"
        print(f"[RAG] Intent: {intent} | parallel prep: {time.time()-t_parallel:.2f}s")

        # 4. Định nghĩa các truy vấn vector
        disease_query = """
            SELECT d.name, dc.content, (1 - (dc.embedding <=> $1::vector)) as score
            FROM disease_chunks dc
            JOIN diseases d ON dc.disease_id = d.id
            WHERE (1 - (dc.embedding <=> $1::vector)) > 0.4
               OR $2 ILIKE '%' || d.name || '%'
            ORDER BY 
               (CASE WHEN $2 ILIKE '%' || d.name || '%' THEN 1 ELSE 0 END) DESC,
               dc.embedding <=> $1::vector
            LIMIT 3
        """

        medicine_query = """
            SELECT m.name, mc.content, (1 - (mc.embedding <=> $1::vector)) as score
            FROM medicine_chunks mc
            JOIN medicines m ON mc.medicine_id = m.id
            WHERE (1 - (mc.embedding <=> $1::vector)) > 0.4
               OR $2 ILIKE '%' || m.name || '%'
            ORDER BY 
               (CASE WHEN $2 ILIKE '%' || m.name || '%' THEN 1 ELSE 0 END) DESC,
               mc.embedding <=> $1::vector
            LIMIT 3
        """

        doctor_chunks_query = """
            SELECT DISTINCT ON (d.id)
                   d.id as doctor_id, p.full_name as name, p.avatar_url, s.name as specialty, doc_c.content,
                   GREATEST(
                       (1 - (doc_c.embedding <=> $1::vector)),
                       COALESCE((
                           SELECT MAX(1 - (dc2.embedding <=> $1::vector))
                           FROM disease_chunks dc2
                           JOIN diseases dis ON dc2.disease_id = dis.id
                           WHERE dis.specialty_id = d.specialty_id
                           LIMIT 5
                       ), 0)
                   ) as score
            FROM doctor_chunks doc_c
            JOIN doctors d ON doc_c.doctor_id = d.id
            JOIN profiles p ON d.id = p.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
            WHERE (1 - (doc_c.embedding <=> $1::vector)) > 0.3
               OR $2 ILIKE '%' || s.name || '%'
               OR $2 ILIKE '%' || p.full_name || '%'
               OR EXISTS (
                   SELECT 1 FROM diseases dis
                   WHERE dis.specialty_id = d.specialty_id
                     AND (
                         $2 ILIKE '%' || dis.name || '%'
                         OR $2 ILIKE '%' || SPLIT_PART(dis.symptoms, ',', 1) || '%'
                     )
               )
            ORDER BY d.id,
               (CASE WHEN $2 ILIKE '%' || s.name || '%' THEN 2
                     WHEN EXISTS (SELECT 1 FROM diseases dis WHERE dis.specialty_id = d.specialty_id AND $2 ILIKE '%' || dis.name || '%') THEN 1
                     ELSE 0 END) DESC,
               doc_c.embedding <=> $1::vector
            LIMIT 3
        """

        # 5. Truy xuất dữ liệu theo intent — tất cả queries chạy SONG SONG
        t_db = time.time()

        async def _fetch_diseases():
            if intent in [Intent.SYMPTOM_INQUIRY, Intent.GENERAL_HEALTH, Intent.EMERGENCY]:
                try:
                    return await db.fetch(disease_query, vector_str, user_input)
                except Exception as e:
                    print(f"[RAG] Lỗi tra cứu disease: {e}")
            return []

        async def _fetch_medicines():
            if intent == Intent.MEDICINE_INQUIRY:
                try:
                    return await db.fetch(medicine_query, vector_str, user_input)
                except Exception as e:
                    print(f"[RAG] Lỗi tra cứu medicine: {e}")
            return []

        async def _fetch_doctors():
            if intent in [Intent.DOCTOR_SEARCH, Intent.APPOINTMENT_BOOKING, Intent.EMERGENCY,
                          Intent.SYMPTOM_INQUIRY, Intent.GENERAL_HEALTH]:
                try:
                    # Dùng rewritten_query cho ILIKE để match tốt hơn từ khóa bệnh/triệu chứng
                    return await db.fetch(doctor_chunks_query, vector_str, rewritten_query)
                except Exception as e:
                    print(f"[RAG] Lỗi tra cứu doctor: {e}")
            return []

        async def _fetch_etl():
            if intent in [Intent.DOCTOR_SEARCH, Intent.APPOINTMENT_BOOKING]:
                try:
                    etl_q = "SELECT report_name, reports FROM etl_reports WHERE report_name = 'top_doctors' ORDER BY created_at DESC LIMIT 1"
                    return await db.fetch(etl_q)
                except Exception as e:
                    print(f"[RAG] Lỗi truy vấn etl_reports: {e}")
            return []

        diseases, medicines, doctor_chunks, etl_reports_data = await asyncio.gather(
            _fetch_diseases(), _fetch_medicines(), _fetch_doctors(), _fetch_etl()
        )
        print(f"[RAG] DB queries: {time.time()-t_db:.2f}s")

        context = []

        for d in diseases:
            context.append(f"Bệnh: {d['name']}\n{d['content']}")

        for m in medicines:
            context.append(f"Thuốc: {m['name']}\n{m['content']}")

        for doc in doctor_chunks:
            context.append(
                f"Bác sĩ (Phù hợp): [ID: {doc['doctor_id']}] [Avatar: {doc['avatar_url']}] {doc['name']} ({doc['specialty']})\n{doc['content']}"
            )

        for report in etl_reports_data:
            try:
                r_json = json.loads(report['reports']) if isinstance(report['reports'], str) else report['reports']
                preview = r_json.get('previewData', [])
                if preview:
                    context.append(f"Gợi ý hệ thống (Top Bác sĩ nổi bật, chứa id, name, specialty, avatar_url): {json.dumps(preview, ensure_ascii=False)}")
            except Exception:
                pass

        context_text = "\n\n".join(context)

        doctor_card_rule = (
            'Nếu nhắc đến bác sĩ từ ngữ cảnh, BẮT BUỘC thêm thẻ: '
            '[DOCTOR_CARD id="<id>" name="<name>" specialty="<specialty>" avatar="<avatar_url>"] '
            'ngay sau tên bác sĩ. Thay thế bằng dữ liệu thật, avatar="None" nếu không có.'
        )

        prompt = (
            f"## Ngữ cảnh\n{context_text}\n\n"
            f"## Lịch sử hội thoại\n{history_text}\n\n"
            f"## Câu hỏi\n{user_input}\n\n"
            f"## Yêu cầu\n"
            f"- Trả lời ngắn gọn, chính xác, hữu ích.\n"
            f"- Ưu tiên 'Bác sĩ (Phù hợp)' khi tìm bác sĩ/đặt lịch; dùng 'Gợi ý hệ thống' để bổ sung nếu cần.\n"
            f"- {doctor_card_rule}"
        )

        full_response = ""
        t_stream = time.time()
        print(f"[RAG] Generating response... (total prep: {t_stream-t_start:.2f}s)")

        try:
            first_token_time = None

            async for chunk in ai_provider.generate_chat(prompt):
                if first_token_time is None:
                    first_token_time = time.time()
                    print(
                        f"[RAG] First token latency: "
                        f"{first_token_time - t_stream:.2f}s"
                    )

                full_response += chunk
                yield chunk

        except asyncio.CancelledError:
            print("[RAG] User ngắt kết nối, hủy stream")
            raise

        except Exception as e:
            import traceback
            error_message = "Xin lỗi, hệ thống AI hiện đang quá tải hoặc đã hết hạn mức sử dụng. Vui lòng thử lại sau."
            full_response = error_message
            yield error_message
            print(f"[RAG] ❌ Gemini API error: {type(e).__name__}: {e}")
            traceback.print_exc()

        print(f"[RAG] ✅ stream: {time.time()-t_stream:.2f}s | TOTAL: {time.time()-t_start:.2f}s")

        await db.execute(
            """
            INSERT INTO chat_messages (id, session_id, role, content)
            VALUES ($1, $2, $3, $4)
            """,
            str(uuid.uuid4()),
            session_id,
            "AI",
            full_response
        )
        
rag_service = RAGService()