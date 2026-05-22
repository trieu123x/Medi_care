import asyncio
import logging
from google import genai
from app.config.config import settings

logger = logging.getLogger(__name__)

class AIProvider:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        # Thứ tự fallback: ưu tiên model có RPD cao nhất
        # RPD: 3.1-flash-lite(500) > 2.5-flash(20) = 2.5-flash-lite(20) = 3-flash(20) > legacy...
        self.fallback_models = [
            'gemini-2.5-flash',        # Primary — RPM:5,  TPM:250K, RPD:20
            'gemini-3.1-flash-lite',   # Fallback #1 — RPM:15, TPM:250K, RPD:500 (highest!)
            'gemini-3.5-flash',        # Fallback #2 — RPM:5,  TPM:250K, RPD:20
            'gemini-3-flash',          # Fallback #3 — RPM:5,  TPM:250K, RPD:20
            'gemini-2.5-flash-lite',   # Fallback #4 — RPM:10, TPM:250K, RPD:20
            'gemini-2.0-flash',        # Fallback #5 — legacy
            'gemini-1.5-flash',        # Fallback #6 — legacy
        ]
        # Set các model đã xác nhận không tồn tại → bỏ qua ở lần sau
        self._invalid_models: set[str] = set()

    # -----------------------------------------------------------------------
    # Error classification helpers
    # -----------------------------------------------------------------------
    def _is_quota_error(self, e: Exception) -> bool:
        """HTTP 429 – hết quota (RPM / RPD / TPM)."""
        s = str(e).lower()
        return (
            "429" in s
            or "quota" in s
            or "resource_exhausted" in s
            or "resourceexhausted" in s
            or "rate limit" in s
            or "too many requests" in s
        )

    def _is_not_found_error(self, e: Exception) -> bool:
        """HTTP 404 – model ID không tồn tại."""
        s = str(e).lower()
        return (
            "404" in s
            or "not found" in s
            or "invalid model" in s
            or "model_not_found" in s
        )

    def _log_model_failure(self, model: str, e: Exception):
        """Log lỗi kèm loại lỗi để dễ debug."""
        if self._is_quota_error(e):
            logger.warning(f"[AI FALLBACK] ❌ {model}: QUOTA EXHAUSTED (429) → thử model tiếp theo")
        elif self._is_not_found_error(e):
            logger.warning(f"[AI FALLBACK] ⚠️  {model}: MODEL NOT FOUND (404) → đánh dấu không hợp lệ")
            self._invalid_models.add(model)  # Không thử lại model này nữa
        else:
            logger.warning(f"[AI FALLBACK] ⚠️  {model}: {type(e).__name__}: {str(e)[:120]} → thử model tiếp theo")

    # -----------------------------------------------------------------------
    # Core generation methods
    # -----------------------------------------------------------------------
    async def generate_chat(self, prompt: str):
        """
        Stream response từng chunk nhỏ. Tự fallback qua các model khi gặp lỗi.
        Bỏ qua các model đã xác nhận không tồn tại (404).
        """
        last_exception = None
        for model in self.fallback_models:
            if model in self._invalid_models:
                logger.debug(f"[AI FALLBACK] Bỏ qua {model} (đã xác nhận không hợp lệ)")
                continue

            try:
                response = await self.client.aio.models.generate_content_stream(
                    model=model,
                    contents=prompt
                )

                # Lấy chunk đầu tiên để phát hiện lỗi 429/503 ngay lập tức
                iterator = response.__aiter__()
                try:
                    first_chunk = await iterator.__anext__()
                    if first_chunk.text:
                        logger.info(f"[AI] Đang dùng model: {model}")
                        yield first_chunk.text
                except StopAsyncIteration:
                    return

                # Stream phần còn lại
                async for texts in iterator:
                    if texts.text:
                        yield texts.text

                return  # ✅ success

            except asyncio.CancelledError:
                logger.info("[AI] User ngắt kết nối — hủy stream.")
                raise
            except Exception as e:
                self._log_model_failure(model, e)
                last_exception = e
                continue

        raise last_exception or Exception("Tất cả các model đều thất bại hoặc quá tải.")

    async def generate_full_text(self, prompt: str) -> str:
        """
        Trả về toàn bộ kết quả ngay lập tức (không stream).
        Dùng cho classify intent, rewrite query, generate topic...
        """
        last_exception = None
        for model in self.fallback_models:
            if model in self._invalid_models:
                logger.debug(f"[AI FALLBACK] Bỏ qua {model} (đã xác nhận không hợp lệ)")
                continue

            try:
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=prompt
                )
                logger.info(f"[AI] generate_full_text dùng model: {model}")
                return response.text
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._log_model_failure(model, e)
                last_exception = e
                continue

        raise last_exception or Exception("Tất cả các model đều thất bại hoặc quá tải.")

    async def generate_text(self, prompt: str) -> str:
        """Alias cho generate_full_text."""
        return await self.generate_full_text(prompt)

    async def list_available_models(self) -> list[str]:
        """
        Lấy danh sách model text generation thực sự hợp lệ từ API.
        Dùng để debug hoặc validate fallback_models khi startup.
        """
        try:
            models = []
            async for m in await self.client.aio.models.list():
                name = m.name.replace("models/", "")
                if "generateContent" in (m.supported_actions or []):
                    models.append(name)
            return models
        except Exception as e:
            logger.error(f"[AI] Không thể list models: {e}")
            return []


ai_provider = AIProvider()