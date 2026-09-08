from fastapi import APIRouter

from app.modules.users.service import UserService


router = APIRouter()


@router.get("/")
def list_users() -> list[str]:
    return UserService().list_users()
