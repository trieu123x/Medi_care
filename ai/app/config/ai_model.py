import asyncio
import logging
from google import genai
from google.genai import types
from app.config.config import settings

logger = logging.getLogger(__name__)

# Config cho các tác vụ phân loại/viết lại query (output ngắn, không cần stream)
SHORT_TASK_CONFIG = types.GenerateContentConfig(
    max_output_tokens=128,
    temperature=0.0,        # Deterministic — phân loại cần chính xác
    top_p=0.9,
)

# Config cho stream chat chính 
CHAT_STREAM_CONFIG = types.GenerateContentConfig(
    max_output_tokens=1024, # ~700-800 từ, đủ cho câu trả lời y tế đầy đủ
    temperature=0.7,
    top_p=0.95,
    system_instruction=(
        "Bạn là MediAssist — trợ lý y tế AI chuyên nghiệp. "
        "Trả lời bằng tiếng Việt, ngắn gọn, chính xác, có cấu trúc rõ ràng. "
        "Không bịa thông tin y tế. Ưu tiên an toàn người dùng."
    ),
)

class AIProvider:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.fallback_models = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ]

    async def generate_chat(self, prompt: str):
        """
        Stream từng chunk nhỏ cho chat chính.
        Dùng CHAT_STREAM_CONFIG với max_output_tokens để tránh stream > 100s.
        """
        last_exception = None
        for model in self.fallback_models:
            try:
                response = await self.client.aio.models.generate_content_stream(
                    model=model,
                    contents=prompt,
                    config=CHAT_STREAM_CONFIG,
                )

                iterator = response.__aiter__()
                try:
                    first_chunk = await iterator.__anext__()
                    if first_chunk.text:
                        yield first_chunk.text
                except StopAsyncIteration:
                    return

                async for texts in iterator:
                    if texts.text:
                        yield texts.text

                return  # success
            except asyncio.CancelledError:
                print("[CẢNH BÁO] User đã ngắt kết nối. Đã hủy tiến trình tạo chữ của AI!")
                raise
            except Exception as e:
                print(f"[AI MODEL FALLBACK] Model {model} thất bại: {e}")
                last_exception = e
                continue

        raise last_exception or Exception("Tất cả các model đều thất bại hoặc quá tải.")

    async def generate_short(self, prompt: str) -> str:
        """
        Sinh text ngắn (phân loại intent, viết lại query…).
        Dùng SHORT_TASK_CONFIG — không stream, không cần system_instruction phức tạp.
        """
        last_exception = None
        for model in self.fallback_models:
            try:
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=SHORT_TASK_CONFIG,
                )
                return response.text or ""
            except Exception as e:
                print(f"[AI MODEL FALLBACK SHORT] Model {model} thất bại: {e}")
                last_exception = e
                continue
        raise last_exception or Exception("Tất cả các model đều thất bại hoặc quá tải.")

    async def generate_full_text(self, prompt: str) -> str:
        """
        Trả về toàn bộ kết quả ngay lập tức (dùng cho generate topic, summary…).
        """
        last_exception = None
        for model in self.fallback_models:
            try:
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=CHAT_STREAM_CONFIG,
                )
                return response.text
            except Exception as e:
                print(f"[AI MODEL FALLBACK] Model {model} thất bại: {e}")
                last_exception = e
                continue
        raise last_exception or Exception("Tất cả các model đều thất bại hoặc quá tải.")

    async def generate_text(self, prompt: str) -> str:
        """Alias cho generate_full_text."""
        return await self.generate_full_text(prompt)


ai_provider = AIProvider()