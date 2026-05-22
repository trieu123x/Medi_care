#!/usr/bin/env python3
"""
Script để chunking và lưu embeddings cho Doctor và Medicine vào Supabase
"""

import sys
import os
import asyncpg
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.embedding_vector_service import EmbeddingService
import uuid

# Load environment
load_dotenv()

async def main():
    print("🚀 Bắt đầu chunking và lưu embeddings cho Doctor và Medicine...")
    
    # Khởi tạo services
    embedding_service = EmbeddingService()
    
    # Kết nối Supabase
    db_url = os.getenv('DATABASE_URL')
    conn = await asyncpg.connect(db_url)
    
    try:
        # =====================================================
        # DOCTOR CHUNKS
        # =====================================================
        print("\n" + "="*60)
        print("📋 PROCESSING DOCTOR DATA")
        print("="*60)
        
        # Lấy dữ liệu bác sĩ từ database
        doctor_query = """
            SELECT d.id, p.full_name, d.experience, d.education, d.achievements, s.name as specialty
            FROM doctors d
            JOIN profiles p ON d.id = p.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
        """
        doctors = await conn.fetch(doctor_query)
        
        print(f"\n📊 Tìm thấy {len(doctors)} bác sĩ để xử lý")
        
        total_doctor_chunks = 0
        for doctor in doctors:
            doctor_id = doctor['id']
            doctor_name = doctor['full_name']
            experience = doctor['experience'] or ""
            education = doctor['education'] or ""
            achievements = doctor['achievements'] or ""
            specialty = doctor['specialty'] or ""
            
            print(f"\n👨‍⚕️ Xử lý bác sĩ: {doctor_name}")
            
            # Embedding with chunking
            full_text = f"Bác sĩ: {doctor_name}. Chuyên khoa: {specialty}. Kinh nghiệm: {experience}. Học vấn: {education}. Thành tích: {achievements}"
            
            embeddings = await embedding_service.embed_disease_data(
                doctor_name,
                f"Chuyên khoa: {specialty}. Kinh nghiệm: {experience}",
                f"Học vấn: {education}. Thành tích: {achievements}"
            )
            
            print(f"   ✓ {len(embeddings)} chunks tạo được")
            
            # Lưu vào database
            for i, emb in enumerate(embeddings):
                chunk_id = str(uuid.uuid4())
                vector_str = '[' + ','.join(map(str, emb['vector'])) + ']'
                
                insert_query = """
                    INSERT INTO doctor_chunks (id, doctor_id, content, embedding)
                    VALUES ($1, $2, $3, $4::vector)
                """
                
                await conn.execute(
                    insert_query,
                    chunk_id,
                    doctor_id,
                    emb['content'],
                    vector_str
                )
                
                print(f"     ✓ Chunk {i+1} lưu thành công")
                total_doctor_chunks += 1
        
        print(f"\n✅ Hoàn tất Doctor! Tổng {total_doctor_chunks} chunks đã được lưu")
        
        # =====================================================
        # MEDICINE CHUNKS
        # =====================================================
        print("\n" + "="*60)
        print("💊 PROCESSING MEDICINE DATA")
        print("="*60)
        
        # Lấy dữ liệu thuốc từ database
        medicine_query = """
            SELECT id, name, ingredients, dosage, usage_instruction, side_effects
            FROM medicines
        """
        medicines = await conn.fetch(medicine_query)
        
        print(f"\n📊 Tìm thấy {len(medicines)} loại thuốc để xử lý")
        
        total_medicine_chunks = 0
        for medicine in medicines:
            medicine_id = medicine['id']
            medicine_name = medicine['name']
            ingredients = medicine['ingredients'] or ""
            dosage = medicine['dosage'] or ""
            usage = medicine['usage_instruction'] or ""
            side_effects = medicine['side_effects'] or ""
            
            print(f"\n💊 Xử lý thuốc: {medicine_name}")
            
            # Embedding with chunking
            embeddings = await embedding_service.embed_medicine_data(
                medicine_name,
                ingredients,
                dosage,
                usage
            )
            
            print(f"   ✓ {len(embeddings)} chunks tạo được")
            
            # Lưu vào database
            for i, emb in enumerate(embeddings):
                chunk_id = str(uuid.uuid4())
                vector_str = '[' + ','.join(map(str, emb['vector'])) + ']'
                
                insert_query = """
                    INSERT INTO medicine_chunks (id, medicine_id, content, embedding)
                    VALUES ($1, $2, $3, $4::vector)
                """
                
                await conn.execute(
                    insert_query,
                    chunk_id,
                    medicine_id,
                    emb['content'],
                    vector_str
                )
                
                print(f"     ✓ Chunk {i+1} lưu thành công")
                total_medicine_chunks += 1
        
        print(f"\n✅ Hoàn tất Medicine! Tổng {total_medicine_chunks} chunks đã được lưu")
        
        # =====================================================
        # VERIFY
        # =====================================================
        print("\n" + "="*60)
        print("📊 VERIFICATION")
        print("="*60)
        
        doctor_count = await conn.fetchval("SELECT COUNT(*) FROM doctor_chunks")
        medicine_count = await conn.fetchval("SELECT COUNT(*) FROM medicine_chunks")
        disease_count = await conn.fetchval("SELECT COUNT(*) FROM disease_chunks")
        
        print(f"\n📈 Tổng chunks trong database:")
        print(f"   - Disease Chunks: {disease_count}")
        print(f"   - Doctor Chunks: {doctor_count}")
        print(f"   - Medicine Chunks: {medicine_count}")
        print(f"   - TOTAL: {disease_count + doctor_count + medicine_count}")
        
        print(f"\n🎉 Hoàn tất toàn bộ chunking!")
        
    except Exception as e:
        print(f"\n❌ Lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
