from sqlalchemy import Column, String, Boolean, LargeBinary, ForeignKey, Text, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
from database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(String, default="Not Started")
    owner = Column(String, ForeignKey("users.email"), nullable=False)
    labels = Column(Text, nullable=False)
    colors = Column(Text, nullable=False)
    yaml_data = Column(LargeBinary, nullable=True)

class User(Base):
    __tablename__ = "users"
    
    email = Column(String, primary_key=True, unique=True, nullable=False)
    password = Column(String, nullable=False)
    projects = Column(Text, nullable=True)

class ImageEntry(Base):
    __tablename__ = "images"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    image_name = Column(String, nullable=False)
    image = Column(LargeBinary, nullable=False)
    yolo = Column(String, nullable=True)
    synthetic = Column(Boolean, default=False)
    finished = Column(Boolean, default=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    frame_number = Column(Integer, nullable=True)
    
    __table_args__ = (
        UniqueConstraint('image_name', 'project_id', name='uix_image_name_project_id'),
        Index('ix_project_frame', 'project_id', 'frame_number')
    )
