import os
import random
import string
import sys
import time
import uuid
from asyncio import sleep

from dotenv import load_dotenv
import requests
import uvicorn
from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.pool import QueuePool
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import create_engine, text, exc
from fastapi import Request

# --- 1. Configuration and Setup ---

# Load environment variables from .env file
load_dotenv()


def build_postgres_url(user, password, host, db_name, port=5432):
    return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"


# --- App Configuration
PDF_REPO_PATH = os.getenv("PDF_REPO_PATH")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Load shared credentials
host = os.getenv("POSTGRES_HOST")
user = os.getenv("POSTGRES_USER")
password = os.getenv("POSTGRES_PASSWORD")

# Load individual DB names
chat_db = os.getenv("POSTGRES_DB_CHAT")
geo_db = os.getenv("POSTGRES_DB_GEO")

# Construct URLs
CHAT_DATABASE_URL = build_postgres_url(user, password, host, chat_db)
GEO_DATABASE_URL = build_postgres_url(user, password, host, geo_db)

RAGFLOW_API_URL = os.getenv("RAGFLOW_API_URL")
RAGFLOW_API_KEY = os.getenv("RAGFLOW_API_KEY")

# Admin user credentials from environment variables
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
DATASET_ID = os.getenv("DATASET_ID")

try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
except ValueError:
    raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES in .env must be an integer.")

if not SECRET_KEY:
    raise RuntimeError("A SECRET_KEY must be set in the .env file for security.")

# --- FastAPI App Initialization
app = FastAPI(
    title="My Application Backend",
    description="Provides access to PDF files and a secure SQL query interface.",
    version="1.0.0",
)

# --- CORS Middleware
origins = [
    "http://localhost:5173",
    "http://localhost",
    "http://127.0.0.1:5173",
    "http://frontend:5173"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Engine
try:
    chat_engine = create_engine(
        CHAT_DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
    )
except Exception as e:
    raise RuntimeError(f"Could not create database chat_engine. Error: {e}")

try:
    geo_engine = create_engine(
        GEO_DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
    )
except Exception as e:
    raise RuntimeError(f"Could not create database chat_engine. Error: {e}")

# --- Security and Authentication Setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


# --- 2. Pydantic Models ---

class User(BaseModel):
    username: str


class UserInDB(User):
    hashed_password: str
    is_admin: bool = False


class UserInDBWithAgent(UserInDB):
    agent_id: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class NewUserRequest(BaseModel):
    username: str
    password: str
    dataset_id: str = Field(DATASET_ID, description="The RAGFlow dataset ID to associate with the new agent.")


class SQLQueryRequest(BaseModel):
    query: str = Field(
        ...,
        example="SELECT name, price FROM products WHERE price > 100",
        description="A read-only SQL SELECT query."
    )


# --- 3. Authentication Functions ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed one."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user_with_agent(token: str = Depends(oauth2_scheme)) -> UserInDBWithAgent:
    """Decodes token, validates user, and returns the full user object from DB."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_from_db(username=username)
    if user is None:
        raise credentials_exception
    return user


def get_user_from_db(username: str) -> UserInDBWithAgent | None:
    """Fetches a user, their agent_id, and admin status from the database."""
    with chat_engine.connect() as connection:
        query = text("SELECT username, hashed_password, agent_id, is_admin FROM users WHERE username = :username")
        result = connection.execute(query, {"username": username}).fetchone()
        if result:
            return UserInDBWithAgent(
                username=result[0],
                hashed_password=result[1],
                agent_id=result[2],
                is_admin=result[3]
            )
    return None


async def get_current_admin_user(current_user: UserInDBWithAgent = Depends(get_current_user_with_agent)):
    """
    Dependency that gets the current user and verifies they are an admin.
    Raises a 403 Forbidden error if the user is not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: This operation requires admin privileges."
        )
    return current_user


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Decodes token, validates user, and returns user object."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = get_user_from_db(username=token_data.username)
    if user is None:
        raise credentials_exception
    return User(username=user.username)


# --- 4. API Endpoints ---

@app.post("/api/login", response_model=Token)
async def login_for_access_token(form_data: LoginRequest = Body(...)):
    """Handles user login and returns a JWT."""
    user = get_user_from_db(username=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def read_root():
    return {"message": "Welcome to the API. Visit /docs for documentation."}


@app.get("/files/{file_name}", response_class=FileResponse)
async def get_pdf_file(file_name: str, current_user: User = Depends(get_current_user)):
    """Serves a PDF file from the repository, requires authentication."""
    if ".." in file_name or "/" in file_name:
        raise HTTPException(status_code=400, detail="Invalid file name.")

    file_path = os.path.join(PDF_REPO_PATH, f"{file_name}.pdf")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path=file_path, media_type='application/pdf', filename=f"{file_name}.pdf")


@app.post("/query")
async def execute_sql_query(request: SQLQueryRequest):
    """
    Validates a user-provided SELECT query, checks for geometry column,
    and wraps it to return GeoJSON if applicable.
    """
    import sqlparse
    from sqlalchemy import text, exc
    from fastapi import HTTPException

    inner_query = request.query.strip().rstrip(";")

    # Basic validation
    statements = sqlparse.parse(inner_query)
    if len(statements) > 1 or not inner_query:
        raise HTTPException(
            status_code=400,
            detail="Invalid request. Only a single SQL statement is allowed."
        )

    statement = statements[0]
    if statement.get_type() != 'SELECT':
        raise HTTPException(
            status_code=400,
            detail=f"Invalid query. Only SELECT statements are allowed, but received a {statement.get_type()} statement."
        )

    try:
        with geo_engine.connect() as connection:
            # Preview result to determine if `geom` exists and is a geometry
            preview_query = f"SELECT * FROM ({inner_query}) AS subquery LIMIT 0"
            preview_result = connection.execute(text(preview_query))
            column_names = preview_result.keys()

            if 'geom' in column_names:
                geom_type_check = connection.execute(text(f"""
                    SELECT GeometryType(geom)
                    FROM ({inner_query}) AS subquery
                    WHERE geom IS NOT NULL
                    LIMIT 1
                """)).scalar()

                if geom_type_check:
                    final_query = f"""
                    SELECT
                      subquery.*,
                      ST_AsGeoJSON(ST_Transform(subquery.geom, 4326)) AS geom
                    FROM (
                      {inner_query}
                    ) AS subquery;
                    """
                else:
                    final_query = inner_query  # geom exists but not geometry
            else:
                final_query = inner_query  # no geom column

            # Execute final query
            result = connection.execute(text(final_query))
            column_names = result.keys()
            data = [dict(zip(column_names, row)) for row in result.fetchall()]
            return {"status": "success", "data": data}

    except exc.SQLAlchemyError as e:
        raise HTTPException(status_code=400, detail=f"Database execution error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.get("/api/agent")
async def get_my_agent_id(current_user: UserInDBWithAgent = Depends(get_current_user_with_agent)):
    """Gets the agent ID for the currently authenticated user."""
    if not current_user.agent_id:
        raise HTTPException(status_code=404, detail="No agent ID associated with this user.")
    return {"agent_id": current_user.agent_id}


@app.post("/api/agents/{agent_id}/sessions")
async def create_new_session(agent_id: str, request: Request):
    """
    Creates a new chat session for the specified agent.
    Sends a request to the RAGFlow API with a generated session name,
    then inserts a corresponding record into the local chats table.
    """
    try:
        body = await request.json()
        username = body.get("user_id")  # username is passed as user_id in frontend
        if not username:
            raise HTTPException(status_code=400, detail="user_id (username) is required.")

        random_name = "session_" + uuid.uuid4().hex[:8]

        # Prepare payload for RAGFlow
        payload = {
            "name": random_name,
            "user_id": username
        }

        headers = {
            "Authorization": f"Bearer {RAGFLOW_API_KEY}",
            "Content-Type": "application/json"
        }

        # Call RAGFlow to create the session
        sessions_url = f"{RAGFLOW_API_URL}/{agent_id}/sessions"
        response = requests.post(sessions_url, headers=headers, json=payload)
        response.raise_for_status()
        session_data = response.json()

        # Extract chat_id from RAGFlow session response
        chat_id = session_data.get("data").get("id")
        messages = session_data.get("data").get("messages")
        if not chat_id:
            raise HTTPException(status_code=500, detail="RAGFlow response missing session ID.")

        # Get internal user_id from local users table using agent_id
        with chat_engine.connect() as conn:
            user_result = conn.execute(
                text("SELECT id FROM users WHERE agent_id = :agent_id"),
                {"agent_id": agent_id}
            ).fetchone()

            if not user_result:
                raise HTTPException(status_code=404, detail="Agent not found in local database.")

            local_user_id = user_result[0]

            # Insert into chats table
            conn.execute(
                text("INSERT INTO chats (id, user_id) VALUES (:chat_id, :user_id)"),
                {"chat_id": chat_id, "user_id": local_user_id}
            )
            create_time_ms = session_data["data"].get("create_time")
            timestamp = datetime.fromtimestamp(create_time_ms / 1000) if create_time_ms else None
            for message in messages:
                conn.execute(
                    text("""
                        INSERT INTO messages (chat_id, sender, message, docs, timestamp, is_theory)
                        VALUES (:chat_id, :sender, :message, :docs, :timestamp, :is_theory)
                    """),
                    {
                        "chat_id": chat_id,
                        "sender": message["role"],
                        "message": message["content"],
                        "docs": [],
                        "timestamp": timestamp,
                        "is_theory": None
                    }
                )
            conn.commit()

        return session_data

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session in RAGFlow: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing request: {e}")


@app.get("/api/agents/{agent_id}/sessions")
async def get_sessions_from_agent(agent_id: str, current_user: User = Depends(get_current_user)):
    """
    Gets all conversation sessions (chats) for a given agent_id,
    including their messages.
    """
    try:
        with chat_engine.connect() as conn:
            # Step 1: Find user ID for the given agent_id
            user_result = conn.execute(
                text("SELECT id FROM users WHERE agent_id = :agent_id"),
                {"agent_id": agent_id}
            ).fetchone()

            if not user_result:
                raise HTTPException(status_code=404, detail="User not found for this agent_id")

            user_id = user_result.id

            # Step 2: Fetch all chats for this user
            chats_result = conn.execute(
                text("SELECT id, created_at FROM chats WHERE user_id = :user_id ORDER BY created_at DESC"),
                {"user_id": user_id}
            ).fetchall()

            chat_sessions = []

            for chat in chats_result:
                chat_sessions.append({
                    "id": chat.id,
                    "timestamp": chat.created_at.isoformat(),
                })

            return chat_sessions

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sessions: {str(e)}")


@app.get("/api/agents/{agent_id}/sessions/{session_id}")
async def get_session(session_id: str, agent_id: str, current_user: User = Depends(get_current_user)):
    """
    Retrieves a full session (chat) and its messages by agent_id and session_id.
    """
    try:
        with chat_engine.connect() as connection:
            # Step 1: Get the user ID from agent_id
            user_result = connection.execute(
                text("SELECT id FROM users WHERE agent_id = :agent_id"),
                {"agent_id": agent_id}
            ).fetchone()

            if not user_result:
                raise HTTPException(status_code=404, detail="Agent not found.")

            user_id = user_result.id

            # Step 2: Ensure the chat belongs to this user
            chat_result = connection.execute(
                text("SELECT id, created_at FROM chats WHERE id = :session_id AND user_id = :user_id"),
                {"session_id": session_id, "user_id": user_id}
            ).fetchone()

            if not chat_result:
                raise HTTPException(status_code=404, detail="Chat session not found for this agent.")

            # Step 3: Fetch all messages for that chat
            messages_result = connection.execute(
                text("""
                    SELECT id, sender, message, docs, timestamp, is_theory
                    FROM messages
                    WHERE chat_id = :chat_id
                    ORDER BY timestamp ASC
                """),
                {"chat_id": session_id}
            ).fetchall()

            # Step 4: Format the response
            messages = [
                {
                    "id": row.id,
                    "sender": row.sender,
                    "message": row.message,
                    "docs": row.docs,
                    "timestamp": row.timestamp.isoformat(),
                    "is_theory": row.is_theory
                }
                for row in messages_result
            ]

            session_data = {
                "id": chat_result.id,
                "timestamp": chat_result.created_at.isoformat(),
                "messages": messages
            }

            return jsonable_encoder(session_data)

    except exc.SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/admin/create-user", status_code=201)
async def admin_create_user(
        user_data: NewUserRequest,
        admin_user: User = Depends(get_current_admin_user)
):
    """
    [ADMIN-ONLY] Creates a new user and a corresponding RAGFlow agent.
    Requires admin privileges.
    """
    try:
        created_user_info = create_ragflow_agent_and_db_user(
            username=user_data.username,
            password=user_data.password,
            dataset_id=user_data.dataset_id
        )
        return {
            "status": "success",
            "detail": "User and agent created successfully.",
            "user": created_user_info
        }
    except ValueError as e:  # Catches "user already exists"
        raise HTTPException(status_code=409, detail=str(e))  # 409 Conflict
    except requests.exceptions.RequestException as e:
        # Error communicating with RAGFlow
        raise HTTPException(status_code=502, detail=f"Failed to create agent in RAGFlow: {e}")
    except (RuntimeError, exc.SQLAlchemyError) as e:
        # Catch DB errors or other internal issues
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@app.delete("/api/admin/users/{username}", status_code=200)
async def delete_user(username: str, admin_user: User = Depends(get_current_admin_user)):
    """
    [ADMIN-ONLY] Deletes a user and their associated RAGFlow agent.
    """
    if username == admin_user.username:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account.")

    # Step 1: Get user details from the database first
    agent_id = None
    with chat_engine.connect() as connection:
        user_query = text("SELECT agent_id FROM users WHERE username = :username")
        user_result = connection.execute(user_query, {"username": username}).fetchone()

        if not user_result:
            raise HTTPException(status_code=404, detail=f"User '{username}' not found.")

        agent_id = user_result.agent_id

    # Step 2: Delete the external RAGFlow agent (outside any DB transaction)
    if agent_id:
        try:
            agent_url = f"{RAGFLOW_API_URL}"
            headers = {"Authorization": f"Bearer {RAGFLOW_API_KEY}"}
            payload = {"ids": [agent_id]}
            response = requests.delete(agent_url, headers=headers, json=jsonable_encoder(payload))
            response.raise_for_status()
            print(f"Successfully deleted RAGFlow agent {agent_id} for user {username}.")
        except requests.exceptions.RequestException as e:
            print(f"Warning: Failed to delete RAGFlow agent {agent_id} for user {username}. Error: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to delete RAGFlow agent, user deletion aborted: {e}")

    # Step 3: If the agent was deleted successfully, delete the user from the database in a new, clean transaction.
    try:
        with chat_engine.connect() as connection:
            with connection.begin():  # Start a single, explicit transaction here
                delete_query = text("DELETE FROM users WHERE username = :username")
                connection.execute(delete_query, {"username": username})
                # The transaction is automatically committed on exiting the 'with' block

        return {"status": "success", "detail": f"User '{username}' and associated agent have been deleted."}
    except exc.SQLAlchemyError as e:
        # This will now only catch errors related to the DELETE statement itself.
        raise HTTPException(status_code=500, detail=f"Database error while deleting user: {str(e)}")


@app.get("/api/user/profile")
async def get_user_profile(current_user: UserInDBWithAgent = Depends(get_current_user_with_agent)):
    """Gets the current user's profile including admin status."""
    return {
        "username": current_user.username,
        "agent_id": current_user.agent_id,
        "is_admin": current_user.is_admin
    }


def generate_random_password(length: int = 12) -> str:
    """Generates a secure, random password."""
    characters = string.ascii_letters + string.digits + string.punctuation
    return ''.join(random.choice(characters) for i in range(length))


def store_user_in_db(username: str, password: str, agent_id: str, is_admin=False):
    """
    Hashes a password and stores a new user with an agent_id in the database.
    This function inserts the username, hashed password, and agent_id into a single row.
    """
    hashed_password = get_password_hash(password)
    try:
        with chat_engine.connect() as connection:
            # This query inserts all relevant user and agent info into the 'users' table
            query = text(
                "INSERT INTO users (username, hashed_password, agent_id, is_admin) "
                "VALUES (:username, :hashed_password, :agent_id, :is_admin)"
            )
            with connection.begin():
                connection.execute(query, {
                    "username": username,
                    "hashed_password": hashed_password,
                    "agent_id": agent_id,
                    "is_admin": is_admin
                })
        print(f"  > Successfully created user '{username}' with agent_id '{agent_id}' in the database.")
    except exc.SQLAlchemyError as e:
        print(f"  > Database error while creating user '{username}': {e}")
        raise


def create_ragflow_agent_and_db_user(username: str, password: str, dataset_id: str, is_admin=False, agent_id=None):
    """
    Creates a single chat agent in RAGFlow and a corresponding user in the local DB.
    Raises exceptions on failure.

    :return: A dict containing the new user's username and agent_id.
    """
    # Check if user already exists in the database
    with chat_engine.connect() as connection:
        user_exists = connection.execute(
            text("SELECT id FROM users WHERE username = :username"),
            {"username": username}
        ).fetchone()
        if user_exists:
            raise ValueError(f"User '{username}' already exists.")

    if not agent_id:
        # RAGFlow API configuration
        chats_url = RAGFLOW_API_URL
        headers = {
            "Authorization": f"Bearer {RAGFLOW_API_KEY}",
            "Content-Type": "application/json"
        }

        # RAGFlow agent creation payload
        payload = {
            "name": f"{username}",
            "dataset_ids": [dataset_id],
            "llm": {"temperature": 0.55, "top_p": 0.3, "presence_penalty": 0.4, "frequency_penalty": 0.7},
            "prompt": {
                "similarity_threshold": 0.2, "keywords_similarity_weight": 0.7, "top_n": 6, "top_k": 1024,
                "empty_response": "Lo siento, no pude encontrar nada relevante.",
                "opener": "¡Hola! Soy tu asistente, ¿en qué puedo ayudarte?",
                "show_quote": True, "reasoning": True, "cross_languages": ["Spanish"], "keyword": True,
                "refine_multiturn": True,
                "prompt": "Eres un asistente inteligente. Por favor, resume el contenido de la base de conocimientos para responder a la pregunta. Enumera los datos de la base de conocimientos y responde en detalle. Cuando todo el contenido de la base de conocimientos sea irrelevante para la pregunta, tu respuesta debe incluir la frase \"¡La respuesta que buscas no se encuentra en la base de conocimientos!\". Las respuestas deben tener en cuenta el historial del chat.\nAquí está la base de conocimientos:\n{knowledge}\nLo anterior es la base de conocimientos."
            }
        }

        # Step 1: Create agent in RAGFlow
        response = requests.post(chats_url, headers=headers, json=payload)
        response.raise_for_status()  # Raises HTTPError for bad responses
        response_data = response.json()

        # Step 2: Extract the agent ID
        agent_id = response_data.get("data", {}).get("id")
        if not agent_id:
            raise RuntimeError(f"Could not find 'id' in RAGFlow API response: {response_data}")

    # Step 3: Store the new user in the database
    store_user_in_db(username, password, agent_id, is_admin=is_admin)

    return {"username": username, "agent_id": agent_id}


@app.get("/api/admin/users")
async def get_all_users(admin_user: User = Depends(get_current_admin_user)):
    """
    [ADMIN-ONLY] Gets a list of all users in the system.
    Requires admin privileges.
    """
    try:
        with chat_engine.connect() as connection:
            query = text("""
                SELECT id, username, agent_id, is_admin, created_at
                FROM users
                ORDER BY created_at DESC
            """)
            result = connection.execute(query).fetchall()
            
            users = [
                {
                    "id": row.id,
                    "username": row.username,
                    "agent_id": row.agent_id,
                    "is_admin": row.is_admin,
                    "created_at": row.created_at.isoformat() if row.created_at else None
                }
                for row in result
            ]
            
            return users
            
    except exc.SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def create_admin_user():
    """Creates a default admin user from environment variables if it doesn't already exist.
       If an admin agent already exists in RAGFlow, reuse its ID instead of creating a new one.
    """
    if not ADMIN_USER or not ADMIN_PASSWORD:
        print("ADMIN_USER or ADMIN_PASSWORD environment variables not set. Skipping admin user creation.")
        return

    try:
        admin_agent_id = None

        # Step 1: Look for existing "admin" agent in RAGFlow
        try:
            headers = {"Authorization": f"Bearer {RAGFLOW_API_KEY}"}
            params = {"name": ADMIN_USER}  # Filter by name
            response = requests.get(RAGFLOW_API_URL, headers=headers, params=params)
            response.raise_for_status()

            chats_data = response.json().get("data", [])
            if chats_data:
                admin_agent_id = chats_data[0]["id"]
                print(f"Found existing admin agent with ID: {admin_agent_id}")
            else:
                print("No existing admin agent found in RAGFlow. Will create a new one.")
        except requests.exceptions.RequestException as e:
            print(f"Warning: Could not fetch admin agent from RAGFlow. Error: {e}")

        # Step 3: If no existing agent, create new one
        create_ragflow_agent_and_db_user(
            username=ADMIN_USER,
            password=ADMIN_PASSWORD,
            dataset_id=DATASET_ID,
            is_admin=True,
            agent_id=admin_agent_id
        )
        print(f"Admin user '{ADMIN_USER}' created successfully with new agent.")

    except ValueError as e:
        print(f"INFO: {e}")
    except exc.SQLAlchemyError as e:
        print(f"FATAL: Could not connect to the database to create admin user: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"FATAL: An unexpected error occurred during admin creation: {e}", file=sys.stderr)
        sys.exit(1)




if __name__ == "__main__":
    print("Waiting for services to be ready...")
    time.sleep(15)

    print("Attempting to create admin user...")
    create_admin_user()

    print("Starting server... Go to http://127.0.0.1:8000/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="debug")