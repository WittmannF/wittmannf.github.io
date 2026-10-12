from fastapi import FastAPI

from app.modules.news_qa.routers.http import router as news_qa_router


app = FastAPI(title="News QA - Feature Packages")
app.include_router(news_qa_router, prefix="/news-qa", tags=["news-qa"])
