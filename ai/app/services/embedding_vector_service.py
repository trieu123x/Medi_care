from google import genai
from app.config.config import settings
import hashlib
import asyncio
from functools import lru_cache

class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = "gemini-embedding-001"
        self.embedding_cache = {}  # In-memory cache for embeddings
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _get_cache_key(self, text: str) -> str:
        """Tạo cache key từ text"""
        return hashlib.md5(text.encode()).hexdigest()
    
    def get_cache_stats(self) -> dict:
        """Lấy thống kê cache"""
        total = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total * 100) if total > 0 else 0
        return {
            "cache_size": len(self.embedding_cache),
            "hits": self.cache_hits,
            "misses": self.cache_misses,
            "hit_rate": f"{hit_rate:.1f}%"
        }

    async def _get_embedding(self, text: str) -> list[float]:
        # Kiểm tra cache trước
        cache_key = self._get_cache_key(text)
        if cache_key in self.embedding_cache:
            self.cache_hits += 1
            stats = self.get_cache_stats()
            print(f"[EMBEDDING CACHE HIT] Sử dụng cached embedding | Stats: {stats}")
            return self.embedding_cache[cache_key]

        self.cache_misses += 1
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = await self.client.aio.models.embed_content(
                    model=self.model_name,
                    contents=text
                )
                embedding_result = response.embeddings[0].values
                # Lưu vào cache
                self.embedding_cache[cache_key] = embedding_result
                stats = self.get_cache_stats()
                print(f"[EMBEDDING MISS] API called | Stats: {stats}")
                return embedding_result
            except Exception as e:
                print(f"[EMBEDDING ERROR] Gemini API error: {str(e)[:50]}")
                if "429" in str(e) or "quota" in str(e).lower() or attempt < max_retries - 1:
                    retry_delay = 1 if attempt < max_retries - 1 else 2
                    print(f"Retrying after {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                else:
                    raise e
        return [0.0] * 3072

    # Vector data bệnh (có áp dụng chunking)
    async def embed_disease_data(self, disease_name: str, description: str, symptoms: str) -> list[dict]:
        from app.services.chunking_service import chunking_service
        full_text = f"Bệnh: {disease_name}. Mô tả: {description}. Triệu chứng: {symptoms}"
        chunks = chunking_service.split_text(full_text)
        
        results = []
        for i, chunk in enumerate(chunks):
            vector = await self._get_embedding(chunk)
            results.append({
                "chunk_index": i,
                "content": chunk,
                "vector": vector
            })
        return results

    # Vector data thuốc (có áp dụng chunking)
    async def embed_medicine_data(self, name: str, ingredients: str, usage: str, side_effects: str) -> list[dict]:
        from app.services.chunking_service import chunking_service
        full_text = f"Thuốc: {name}. Thành phần: {ingredients}. Hướng dẫn: {usage}. Tác dụng phụ: {side_effects}"
        chunks = chunking_service.split_text(full_text)
        
        results = []
        for i, chunk in enumerate(chunks):
            vector = await self._get_embedding(chunk)
            results.append({
                "chunk_index": i,
                "content": chunk,
                "vector": vector
            })
        return results

    # Vector data bác sĩ (có áp dụng chunking)
    async def embed_doctor_data(self, name: str, specialty: str, experience: str, education: str) -> list[dict]:
        from app.services.chunking_service import chunking_service
        full_text = f"Bác sĩ: {name}. Chuyên khoa: {specialty}. Kinh nghiệm: {experience}. Học vấn: {education}"
        chunks = chunking_service.split_text(full_text)
        
        results = []
        for i, chunk in enumerate(chunks):
            vector = await self._get_embedding(chunk)
            results.append({
                "chunk_index": i,
                "content": chunk,
                "vector": vector
            })
        return results

    # Vector data của đoạn chat
    async def embed_user_query(self, user_message_content: str) -> list[float]:
        return await self._get_embedding(user_message_content)

embedding_service = EmbeddingService()