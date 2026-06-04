from fastapi import APIRouter
from app.models.models import DiseaseRequest, DiseaseResponse, MedicineRequest, DoctorRequest

router = APIRouter()

@router.post("")
async def disease_to_vector(request: DiseaseRequest) -> DiseaseResponse:
    """
        Chia nhỏ văn bản (symptoms/description) thành các chunk và tạo vector.
    """
    from app.services.embedding_vector_service import embedding_service
    
    # Ở đây chúng ta chỉ nhận 'content' từ request, coi như đó là nội dung cần chunk
    # Nếu muốn tốt hơn, backend nên gửi cả tên bệnh.
    chunks = await embedding_service.embed_disease_data("Thông tin y khoa", request.content, "")
    
    return DiseaseResponse(chunks=chunks)

@router.post("/medicine")
async def medicine_to_vector(request: MedicineRequest) -> DiseaseResponse:
    from app.services.embedding_vector_service import embedding_service
    chunks = await embedding_service.embed_medicine_data(
        request.name, request.ingredients, request.usage, request.side_effects
    )
    return DiseaseResponse(chunks=chunks)

@router.post("/doctor")
async def doctor_to_vector(request: DoctorRequest) -> DiseaseResponse:
    from app.services.embedding_vector_service import embedding_service
    chunks = await embedding_service.embed_doctor_data(
        request.name, request.specialty, request.experience, request.education,
        diseases=request.diseases
    )
    return DiseaseResponse(chunks=chunks)
