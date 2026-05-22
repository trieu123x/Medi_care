from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.models import ChatRequest
from app.services.rag import rag_service

router = APIRouter()

async def stream_generator(session_id: str, user_input: str):
    """
    Async generator to stream chat responses
    """
    async for chunk in rag_service.build_and_stream(
        session_id=session_id,
        user_input=user_input
    ):
        yield chunk

@router.post("")
async def chat(request: ChatRequest):
    """
    Thực thi logic của chat, nhận vào session_id và prompt, trả về response
    """

    stream = stream_generator(
        session_id=request.session_id,
        user_input=request.user_input
    )
    
    return StreamingResponse(stream, media_type="text/event-stream")
