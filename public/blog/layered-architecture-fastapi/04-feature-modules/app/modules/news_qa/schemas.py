from pydantic import BaseModel


class IngestRequest(BaseModel):
    topic: str


class QuestionRequest(BaseModel):
    question: str


class AnswerResponse(BaseModel):
    answer: str
    sources: list[str]
