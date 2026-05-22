from app.config.ai_model import ai_provider
from app.config.database import db
from google.genai import errors
from app.services.embedding_vector_service import embedding_service
from app.services.cache_service import cache_service, rate_limiter
from enum import Enum
import json
import uuid

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

    async def rewrite_query_and_classify_intent(self, history_text: str, user_input: str) -> tuple[str, Intent]:
        """
        Kết hợp rewrite_query và classify_intent trong 1 lần gọi API để tiết kiệm quota.
        Có cache theo (history_text, user_input) — TTL 1 giờ.
        Trả về (standalone_query, intent)
        """
        # --- Cache check ---
        cached = cache_service.get("rewrite_intent", history_text, user_input)
        if cached is not None:
            print(f"[RAG] Cache hit: rewrite_intent")
            return cached

        if not history_text:
            # Không có lịch sử → không cần rewrite, nhưng vẫn classify
            intent = await self._classify_intent_only(user_input)
            result = (user_input, intent)
            cache_service.set(result, "rewrite_intent", history_text, user_input)
            return result

        prompt = f"""
        Bạn là bộ xử lý trí tuệ nhân tạo cho chatbot y tế. Thực hiện 2 nhiệm vụ:

        1. Viết lại câu hỏi thành truy vấn độc lập, đầy đủ ý nghĩa
        2. Phân loại ý định vào một trong các nhãn:
           - symptom_inquiry: hỏi về triệu chứng, nguyên nhân bệnh
           - medicine_inquiry: hỏi về thuốc, cách dùng, tác dụng phụ
           - doctor_search: tìm bác sĩ hoặc chuyên khoa phù hợp
           - appointment_booking: đặt lịch khám, hẹn bác sĩ
           - general_health: tư vấn sức khỏe chung
           - emergency: tình huống khẩn cấp, triệu chứng nguy hiểm

        Lịch sử hội thoại:
        {history_text}

        Câu hỏi người dùng:
        {user_input}

        Trả lời theo định dạng:
        REWRITTEN_QUERY: [câu truy vấn đã viết lại]
        INTENT: [tên nhãn]
        """

        try:
            # Dùng generate_full_text vì chỉ cần parse text ngắn, không cần stream
            result_text = await ai_provider.generate_full_text(prompt)

            # Parse kết quả
            lines = result_text.strip().split('\n')
            rewritten_query = user_input
            intent = Intent.GENERAL_HEALTH

            for line in lines:
                if line.startswith('REWRITTEN_QUERY:'):
                    rewritten_query = line.replace('REWRITTEN_QUERY:', '').strip()
                elif line.startswith('INTENT:'):
                    intent_str = line.replace('INTENT:', '').strip().lower()
                    if intent_str in [e.value for e in Intent]:
                        intent = Intent(intent_str)

            result = (rewritten_query, intent)
            cache_service.set(result, "rewrite_intent", history_text, user_input)
            return result

        except Exception as e:
            print(f"[RAG] Lỗi rewrite_query_and_classify_intent: {e}")
            return user_input, Intent.GENERAL_HEALTH

    async def _classify_intent_only(self, user_input: str) -> Intent:
        """
        Phân loại ý định khi không có lịch sử.
        Dùng generate_full_text (không stream) vì chỉ cần 1 từ nhãn.
        Có cache theo user_input.
        """
        # --- Cache check ---
        cached = cache_service.get("classify_only", user_input)
        if cached is not None:
            print(f"[RAG] Cache hit: classify_only")
            return cached

        prompt = f"""
        Phân loại câu hỏi này vào một nhãn:
        - symptom_inquiry
        - medicine_inquiry
        - doctor_search
        - appointment_booking
        - general_health
        - emergency

        Câu hỏi: {user_input}

        Chỉ trả về tên nhãn, không giải thích.
        """

        try:
            result = await ai_provider.generate_full_text(prompt)
            intent_str = result.strip().lower()
            if intent_str in [e.value for e in Intent]:
                intent = Intent(intent_str)
                cache_service.set(intent, "classify_only", user_input)
                return intent
        except Exception:
            pass

        return Intent.GENERAL_HEALTH

    async def build_and_stream(self, session_id: str, user_input: str):
        # 0. Rate limit check
        if not rate_limiter.is_allowed(session_id):
            remaining_wait = 60  # seconds
            yield f"Bạn đang gửi quá nhiều tin nhắn. Vui lòng chờ khoảng {remaining_wait} giây và thử lại."
            return

        # 1. Lưu tin nhắn của user vào DB ngay lập tức
        try:
            await db.execute(
                """
                INSERT INTO chat_messages (id, session_id, role, content)
                VALUES ($1, $2, $3, $4)
                """,
                str(uuid.uuid4()),
                session_id,
                "user",
                user_input,
            )
        except Exception as e:
            print(f"[RAG] Lỗi lưu tin nhắn user: {e}")

        # 2. Lấy lịch sử chat (bao gồm cả tin vừa lưu)
        history_query = """
            SELECT role, content
            FROM chat_messages
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT 6
        """
        history_rows = await db.fetch(history_query, session_id)
        history = list(reversed(history_rows))
        history_text = "\n".join(
            f"{row['role']}: {row['content']}"
            for row in history
        )

        # 3. Viết lại câu hỏi + phân loại ý định (có cache)
        standalone_query, intent = await self.rewrite_query_and_classify_intent(history_text, user_input)
        print(f"[RAG] Intent: {intent}, Query: {standalone_query}")

        # 4. Tạo embedding (có cache)
        cached_vector = cache_service.get("embedding", standalone_query)
        if cached_vector is not None:
            print(f"[RAG] Cache hit: embedding")
            query_vector = cached_vector
        else:
            query_vector = await embedding_service.embed_user_query(standalone_query)
            cache_service.set(query_vector, "embedding", standalone_query)

        vector_str = f"[{','.join(map(str, query_vector))}]"

        # 5. Định nghĩa các truy vấn vector
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
            SELECT p.full_name as name, s.name as specialty, doc_c.content,
                   (1 - (doc_c.embedding <=> $1::vector)) as score
            FROM doctor_chunks doc_c
            JOIN doctors d ON doc_c.doctor_id = d.id
            JOIN profiles p ON d.id = p.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
            WHERE (1 - (doc_c.embedding <=> $1::vector)) > 0.4
               OR $2 ILIKE '%' || s.name || '%'
               OR $2 ILIKE '%' || p.full_name || '%'
            ORDER BY 
               (CASE WHEN $2 ILIKE '%' || s.name || '%' THEN 1 ELSE 0 END) DESC,
               (CASE WHEN $2 ILIKE '%' || p.full_name || '%' THEN 1 ELSE 0 END) DESC,
               doc_c.embedding <=> $1::vector
            LIMIT 3
        """

        # 6. Truy xuất dữ liệu theo intent
        diseases, medicines, doctor_chunks = [], [], []

        try:
            if intent in [Intent.SYMPTOM_INQUIRY, Intent.GENERAL_HEALTH, Intent.EMERGENCY]:
                diseases = await db.fetch(disease_query, vector_str, standalone_query)

            if intent == Intent.MEDICINE_INQUIRY:
                medicines = await db.fetch(medicine_query, vector_str, standalone_query)

            if intent in [Intent.DOCTOR_SEARCH, Intent.APPOINTMENT_BOOKING, Intent.EMERGENCY]:
                doctor_chunks = await db.fetch(doctor_chunks_query, vector_str, standalone_query)

        except Exception as e:
            print(f"[RAG] Lỗi tra cứu vector: {e}")
            diseases, medicines, doctor_chunks = [], [], []

        # 7. Thu thập dữ liệu từ ETL_REPORTS (chỉ khi intent liên quan)
        etl_reports_data = []
        if intent in [Intent.DOCTOR_SEARCH, Intent.APPOINTMENT_BOOKING]:
            try:
                etl_query = "SELECT report_name, reports FROM etl_reports WHERE report_name = 'top_doctors' ORDER BY created_at DESC LIMIT 1"
                etl_reports_data = await db.fetch(etl_query)
            except Exception as e:
                print(f"[RAG] Lỗi truy vấn etl_reports: {e}")

        context = []

        for d in diseases:
            context.append(f"Bệnh: {d['name']}\n{d['content']}")

        for m in medicines:
            context.append(f"Thuốc: {m['name']}\n{m['content']}")

        for doc in doctor_chunks:
            context.append(
                f"Bác sĩ (Phù hợp): {doc['name']} ({doc['specialty']})\n{doc['content']}"
            )

        for report in etl_reports_data:
            try:
                r_json = json.loads(report['reports']) if isinstance(report['reports'], str) else report['reports']
                preview = r_json.get('previewData', [])
                if preview:
                    context.append(f"Gợi ý hệ thống (Top Bác sĩ nổi bật): {json.dumps(preview, ensure_ascii=False)}")
            except Exception:
                pass

        context_text = "\n\n".join(context)

        prompt = f"""
        Bạn là trợ lý y tế AI (MediAssist).

        Ngữ cảnh tham khảo (bao gồm thông tin vector và gợi ý từ hệ thống):
        {context_text}

        Lịch sử hội thoại:
        {history_text}

        Câu hỏi hiện tại:
        {user_input}

        Yêu cầu: 
        - Hãy trả lời ngắn gọn, chính xác, và hữu ích.
        - Không cần chào
        - Nếu người dùng tìm bác sĩ hoặc đặt lịch, hãy ưu tiên dùng danh sách 'Bác sĩ (Phù hợp)' trước. Nếu có 'Gợi ý hệ thống (Top Bác sĩ)', có thể dùng để khuyến nghị thêm các lựa chọn uy tín nếu phù hợp.
        """

        full_response = ""

        try:
            async for chunk in ai_provider.generate_chat(prompt):
                full_response += chunk
                yield chunk

        except Exception as e:
            error_message = "Xin lỗi, hệ thống AI hiện đang quá tải hoặc đã hết hạn mức sử dụng. Vui lòng thử lại sau."
            full_response = error_message
            yield error_message
            print(f"[RAG] Gemini API error: {e}")

        # 8. Lưu phản hồi của AI
        try:
            await db.execute(
                """
                INSERT INTO chat_messages (id, session_id, role, content)
                VALUES ($1, $2, $3, $4)
                """,
                str(uuid.uuid4()),
                session_id,
                "AI",
                full_response,
            )
        except Exception as e:
            print(f"[RAG] Lỗi lưu tin nhắn AI: {e}")

rag_service = RAGService()
