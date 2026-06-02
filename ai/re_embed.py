# -*- coding: utf-8 -*-
"""
Script re-embed toan bo disease_chunks, medicine_chunks, doctor_chunks
bang gemini-embedding-001 (3072 chieu).

Chay: py re_embed.py
"""
import asyncio
import asyncpg
from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 3072

client = genai.Client(api_key=GEMINI_API_KEY)


async def get_embedding(text: str) -> list[float]:
    """Gọi Gemini embedding API, retry tối đa 3 lần nếu gặp lỗi."""
    for attempt in range(3):
        try:
            response = await client.aio.models.embed_content(
                model=EMBED_MODEL,
                contents=text,
            )
            return list(response.embeddings[0].values)
        except Exception as e:
            print(f"  [RETRY {attempt+1}/3] Embedding error: {e}")
            await asyncio.sleep(2 ** attempt)
    print("  [FAIL] Trả về zero vector")
    return [0.0] * EMBED_DIM


async def re_embed_table(conn: asyncpg.Connection, table: str, id_col: str):
    """Re-embed toàn bộ rows trong một bảng chunk."""
    rows = await conn.fetch(f"SELECT id, content FROM {table} ORDER BY id")
    total = len(rows)
    print(f"\n{'='*50}")
    print(f"[{table}] Tìm thấy {total} chunks — bắt đầu re-embed...")
    print(f"{'='*50}")

    for i, row in enumerate(rows, 1):
        chunk_id = row["id"]
        content = row["content"]
        print(f"  [{i}/{total}] id={chunk_id} — {content[:60]}...")

        vector = await get_embedding(content)
        vector_str = f"[{','.join(map(str, vector))}]"

        await conn.execute(
            f"UPDATE {table} SET embedding = $1::vector WHERE id = $2",
            vector_str, chunk_id
        )
        print(f"  ✅ Đã cập nhật embedding ({len(vector)} chiều)")

        # Rate limit: tránh vượt quota Gemini
        await asyncio.sleep(0.3)

    print(f"\n[{table}] ✅ Hoàn thành {total}/{total} chunks")


async def check_and_fix_dimension(conn: asyncpg.Connection, table: str):
    """Kiểm tra và cập nhật dimension của cột embedding nếu cần."""
    row = await conn.fetchrow(
        f"SELECT vector_dims(embedding) as dims FROM {table} WHERE embedding IS NOT NULL LIMIT 1"
    )
    if row:
        current_dim = row["dims"]
        print(f"[{table}] Dimension hiện tại: {current_dim}")
        if current_dim != EMBED_DIM:
            print(f"[{table}] ⚠️  Cần đổi từ {current_dim} → {EMBED_DIM} chiều...")
            await conn.execute(
                f"ALTER TABLE {table} ALTER COLUMN embedding TYPE vector({EMBED_DIM}) USING NULL"
            )
            print(f"[{table}] ✅ Đã cập nhật column type sang vector({EMBED_DIM})")
    else:
        print(f"[{table}] Chưa có embedding nào — sẽ tạo mới toàn bộ")


async def main():
    print(f"[START] Re-embed voi model: {EMBED_MODEL} ({EMBED_DIM} chieu)")
    print(f"[DB] Ket noi: {DATABASE_URL[:40]}...")

    conn = await asyncpg.connect(DATABASE_URL)

    tables = [

        ("doctor_chunks", "doctor_id"),
    ]

    # Bước 1: Kiểm tra và fix dimension
    print("\n--- Kiểm tra dimension ---")
    for table, id_col in tables:
        try:
            await check_and_fix_dimension(conn, table)
        except Exception as e:
            print(f"[{table}] Lỗi khi kiểm tra dimension: {e}")

    # Bước 2: Re-embed từng bảng
    for table, id_col in tables:
        try:
            await re_embed_table(conn, table, id_col)
        except Exception as e:
            print(f"\n[{table}] ❌ Lỗi: {e}")

    await conn.close()
    print("\n[DONE] Re-embed hoan tat!")


if __name__ == "__main__":
    asyncio.run(main())
