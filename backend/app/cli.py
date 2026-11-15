"""Management commands: python -m app.cli [init|seed|reset|createadmin EMAIL PASSWORD]"""
import sys

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
import app.models  # noqa: F401
from app.seed import seed_demo, seed_reference


def main(cmd: str) -> None:
    if cmd == "reset":
        Base.metadata.drop_all(engine)
    if cmd in ("init", "seed", "reset"):
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            seed_reference(db)
            if cmd in ("seed", "reset"):
                seed_demo(db)
            db.commit()
        print(f"Database ready: {get_settings().database_url}")
    elif cmd == "createadmin" and len(sys.argv) == 4:
        from sqlalchemy import select

        from app.core.security import hash_password
        from app.models import Branch, Role, User

        with SessionLocal() as db:
            role = db.execute(select(Role).where(Role.name == "Admin")).scalar_one_or_none()
            branch = db.execute(select(Branch).where(Branch.code == "HQ")).scalar_one_or_none()
            if role is None or branch is None:
                sys.exit("Run `python -m app.cli init` first.")
            db.add(User(email=sys.argv[2].lower(), full_name="Administrator", password_hash=hash_password(sys.argv[3]),
                        role_id=role.id, branch_id=branch.id))
            db.commit()
        print("Admin created.")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
