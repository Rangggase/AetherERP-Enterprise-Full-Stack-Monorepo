"""Management commands: python -m app.cli [init|seed|reset]"""
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
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
