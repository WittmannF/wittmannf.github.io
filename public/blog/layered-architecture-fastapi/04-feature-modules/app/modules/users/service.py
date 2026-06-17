from app.modules.users.repositories import UserRepository


class UserService:
    def __init__(self) -> None:
        self.repo = UserRepository()

    def list_users(self) -> list[str]:
        return self.repo.list_users()
