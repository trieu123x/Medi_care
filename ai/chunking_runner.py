#!/usr/bin/env python3
"""
Script để chạy chunking service và embedding vector service
Sẽ xử lý chunking dữ liệu từ database
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.chunking_service import ChunkingService
from app.services.embedding_vector_service import EmbeddingService
from app.config.database import db
import asyncio

async def main():
    print("🚀 Bắt đầu chunking và embedding dữ liệu...")
    
    # Khởi tạo services
    chunking_service = ChunkingService(chunk_size=600, chunk_overlap=100)
    embedding_service = EmbeddingService()
    
    # Kết nối database
    await db.connect()
    
    try:
        # Lấy dữ liệu bệnh từ database
        query = "SELECT id, name, description, symptoms FROM diseases LIMIT 10"
        diseases = await db.fetch(query)
        
        print(f"\n📊 Tìm thấy {len(diseases)} bệnh để xử lý")
        
        for disease in diseases:
            disease_id = disease['id']
            disease_name = disease['name']
            disease_desc = disease['description'] or ""
            disease_symptoms = disease['symptoms'] or ""
            
            print(f"\n📄 Xử lý bệnh: {disease_name}")
            print(f"   Mô tả: {len(disease_desc)} ký tự")
            
            # Embedding with chunking
            embeddings = await embedding_service.embed_disease_data(
                disease_name,
                disease_desc,
                disease_symptoms
            )
            
            print(f"   ✓ Embeddings tạo được: {len(embeddings)} chunks")
            for i, emb in enumerate(embeddings):
                print(f"     - Chunk {i+1}: {len(emb['content'])} ký tự, vector: {len(emb['vector'])} dims")
        
        print("\n✅ Hoàn tất chunking và embedding!")
        
    except Exception as e:
        print(f"\n❌ Lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
