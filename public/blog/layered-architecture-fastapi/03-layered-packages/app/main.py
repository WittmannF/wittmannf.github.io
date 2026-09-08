from fastapi import FastAPI

from app.api.routers.news_qa import router as news_qa_router


def create_app() -> FastAPI:
    app = FastAPI(title="News QA - Layered Packages")
    app.include_router(news_qa_router, prefix="/news-qa", tags=["news-qa"])
    return app


app = create_app()
