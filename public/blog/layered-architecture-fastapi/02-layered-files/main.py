from fastapi import FastAPI

from repositories import ArticleRepository, NewsRepository
from router import router, set_service
from services import NewsQAService


app = FastAPI(title="News QA - Layered Files")

article_repo = ArticleRepository()
news_repo = NewsRepository()
service = NewsQAService(article_repo=article_repo, news_repo=news_repo)

set_service(service)
app.include_router(router)
