#!/usr/bin/env python3
"""
Script để chunking và lưu embeddings vào Supabase
"""

import sys
import os
import asyncpg
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.chunking_service import ChunkingService
from app.services.embedding_vector_service import EmbeddingService
import uuid

# Load environment
load_dotenv()

async def main():
    print("🚀 Bắt đầu chunking và lưu embeddings vào Supabase...")
    
    # Khởi tạo services
    chunking_service = ChunkingService(chunk_size=600, chunk_overlap=100)
    embedding_service = EmbeddingService()
    
    # Kết nối Supabase
    db_url = os.getenv('DATABASE_URL')
    conn = await asyncpg.connect(db_url)
    
    try:
        # Lấy dữ liệu bệnh từ database
        query = "SELECT id, name, description, symptoms FROM diseases"
        diseases = await conn.fetch(query)
        
        print(f"\n📊 Tìm thấy {len(diseases)} bệnh để xử lý")
        
        total_chunks = 0
        for disease in diseases:
            disease_id = disease['id']
            disease_name = disease['name']
            disease_desc = disease['description'] or ""
            disease_symptoms = disease['symptoms'] or ""
            
            print(f"\n📄 Xử lý bệnh: {disease_name}")
            
            # Embedding with chunking
            embeddings = await embedding_service.embed_disease_data(
                disease_name,
                disease_desc,
                disease_symptoms
            )
            
            print(f"   ✓ {len(embeddings)} chunks tạo được")
            
            # Lưu vào database
            for i, emb in enumerate(embeddings):
                chunk_id = str(uuid.uuid4())
                
                # Convert vector to string format cho pgvector
                vector_str = '[' + ','.join(map(str, emb['vector'])) + ']'
                
                insert_query = """
                    INSERT INTO disease_chunks (id, disease_id, content, embedding)
                    VALUES ($1, $2, $3, $4::vector)
                """
                
                await conn.execute(
                    insert_query,
                    chunk_id,
                    disease_id,
                    emb['content'],
                    vector_str
                )
                
                print(f"     ✓ Chunk {i+1} lưu thành công (ID: {chunk_id[:8]}...)")
                total_chunks += 1
        
        print(f"\n✅ Hoàn tất! Tổng {total_chunks} chunks đã được lưu vào database")
        
        # Verify
        verify_query = "SELECT COUNT(*) as count FROM disease_chunks"
        result = await conn.fetchval(verify_query)
        print(f"📊 Xác nhận: {result} chunks trong database")
        
    except Exception as e:
        print(f"\n❌ Lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
