from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Nombre de la base de datos
DB_NAME = "data/PFG_Mikel.db"

# Ruta de conexión SQLite
DATABASE_URL = f"sqlite:///./{DB_NAME}"

# Crea el engine (motor de conexión)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Crea la sesión de base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para las clases ORM
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()