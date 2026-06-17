from fastapi import FastAPI

from app.modules.news_qa.router import router as news_qa_router
from app.modules.users.router import router as users_router


app = FastAPI(title="News QA - Feature Modules")
app.include_router(news_qa_router, prefix="/news-qa", tags=["news-qa"])
app.include_router(users_router, prefix="/users", tags=["users"])
