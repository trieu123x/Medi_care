import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import settings
from app.config.database import db
from app.api import chat, predict, disease

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("startup")

@app.on_event("startup")
async def startup_event():
    await db.connect()
    # Validate fallback model list — log rõ model nào hợp lệ để debug
    from app.config.ai_model import ai_provider
    valid_models = await ai_provider.list_available_models()
    if valid_models:
        configured = ai_provider.fallback_models
        ok  = [m for m in configured if any(m in v for v in valid_models)]
        bad = [m for m in configured if not any(m in v for v in valid_models)]
        logger.info(f"✅ Model hợp lệ trong fallback list: {ok}")
        if bad:
            logger.warning(f"⚠️  Model KHÔNG tìm thấy trên API (sẽ trả 404): {bad}")
            # Đánh dấu ngay để tránh retry vô ích
            for m in bad:
                ai_provider._invalid_models.add(m)
    else:
        logger.warning("⚠️  Không thể xác thực model list — tiếp tục với fallback mặc định")

@app.on_event("shutdown")
async def shutdown_event():
    await db.disconnect()

app.include_router(chat.router, prefix="/ai/chat", tags=["chat"])
app.include_router(predict.router, prefix="/ai/predict", tags=["predict"])
app.include_router(disease.router, prefix="/ai/disease", tags=["disease"])

@app.get("/")
def root():
    return {"message": "Welcome to MediCare AI Service!"}

