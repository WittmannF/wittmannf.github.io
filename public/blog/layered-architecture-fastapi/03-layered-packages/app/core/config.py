from pydantic import BaseModel


class Settings(BaseModel):
    news_api_key: str = "local-dev"
    llm_model: str = "fake-llm"


settings = Settings()
