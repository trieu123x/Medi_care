from pydantic import BaseModel
from typing import List

class ChatRequest(BaseModel):
    session_id: str
    user_input: str
    
class TopicPredictRequest(BaseModel):
    session_id: str

class TitlePredictRequest(BaseModel):
    first_message: str

class TitlePredictResponse(BaseModel):
    title: str

class DiseaseRequest(BaseModel):
    content: str

class DiseaseResponse(BaseModel):
    chunks: List[dict]

class MedicineRequest(BaseModel):
    name: str
    ingredients: str
    usage: str
    side_effects: str

class DoctorRequest(BaseModel):
    name: str
    specialty: str
    experience: str
    education: str
    diseases: str = ""  # Danh sách bệnh/triệu chứng chuyên khoa (tùy chọn, giúp vector matching chính xác hơn)

