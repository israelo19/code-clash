"""AI service: the companion chat, the document reader and the cost estimates.

This service is INTERNAL. Only the backend (App.js) should call it. It holds the
paid API key, so it must not be reachable from the internet:

  - With AI_SERVICE_TOKEN set, every request must carry that token.
  - With no token set, only requests from this same machine are answered.

Run it:  uvicorn main:app --host 127.0.0.1 --port 8000
Check:   http://localhost:8000/health shows whether it is in mock mode.
While developing, start it with AI_DOCS=1 to get FastAPI's test page at /docs.
"""
import hmac
import json
import logging
import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from starlette.middleware.body_limit import RequestBodyLimitMiddleware

import records as store
from companion import chat
from estimate_stub import estimate, estimate_visit, nearby_clinics, service_menu
from extract import extract_document
from llm import MOCK_MODE, MODEL

log = logging.getLogger("ai-service")

MAX_BODY_BYTES = 16 * 1024 * 1024  # a little over the backend's 15 MB upload limit
MAX_RECORDS_BYTES = 500_000  # the patient records sent along with one chat message
INTERNAL_TOKEN = os.getenv("AI_SERVICE_TOKEN", "").strip()
THIS_MACHINE = {"127.0.0.1", "::1", "localhost"}


def caller_is_allowed(client_host, supplied_token, token=None):
    """Who may call this service. See the note at the top of the file."""
    token = INTERNAL_TOKEN if token is None else token
    if token:
        # compare_digest takes the same time whether the first or the last
        # character is wrong, so timing gives nothing away.
        return hmac.compare_digest(str(supplied_token or "").encode(), token.encode())
    return client_host in THIS_MACHINE


def internal_only(request: Request):
    host = request.client.host if request.client else ""
    if not caller_is_allowed(host, request.headers.get("x-internal-token")):
        raise HTTPException(status_code=403, detail="This service only answers the backend.")


# The automatic /docs and /openapi.json pages list every endpoint, so they are
# off unless you ask for them while developing.
SHOW_DOCS = os.getenv("AI_DOCS") == "1"
app = FastAPI(
    title="Health companion AI service",
    docs_url="/docs" if SHOW_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if SHOW_DOCS else None,
)

# Stop reading a request once it is larger than this, and answer 413. Without a
# limit, someone could send a huge body and fill the server's memory or disk
# before any of our own checks run.
app.add_middleware(RequestBodyLimitMiddleware, max_body_size=MAX_BODY_BYTES)

# No CORS settings on purpose: browsers never call this service, the backend does.

# Every endpoint below is on this router, which checks the caller first.
api = APIRouter(dependencies=[Depends(internal_only)])

# Patterns for the small pieces of text the endpoints accept.
SERVICE_CODE = r"^[A-Za-z0-9]{5}$"
ZIP_CODE = r"^\d{5}$"
PATIENT_ID = r"^[A-Za-z0-9_-]{1,64}$"


@app.get("/health")
def health():
    """Open to anyone who can reach the port. It says nothing secret."""
    return {"ok": True, "mock_mode": MOCK_MODE, "model": None if MOCK_MODE else MODEL}


# A plain "def", not "async def": reading a photo and waiting for the model take
# seconds, and FastAPI runs plain functions on worker threads, so one slow
# upload does not freeze every other request.
@api.post("/extract")
def extract_endpoint(file: UploadFile = File(...)):
    """Photo or PDF in -> structured record out. Nothing is stored here: the backend saves it."""
    file_bytes = file.file.read(MAX_BODY_BYTES + 1)
    if len(file_bytes) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="That file is too large.")
    try:
        record = extract_document(file_bytes, file.content_type)
    except ValueError as e:  # a file we cannot read: the message is written for the user
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # The details may hold parts of the document or of the API's reply, so
        # they go to our log and the caller gets a plain message.
        log.exception("Document reader failed")
        raise HTTPException(status_code=502, detail="The document reader could not read that file right now.")
    return record


# ---- Cost estimates, owned by the cost-model person (workstream D). Numbers come from the trained model.


class EstimateRequest(BaseModel):
    service_code: Optional[str] = Field(None, pattern=SERVICE_CODE)  # one service, e.g. "87880"
    visit: Optional[str] = Field(None, max_length=40)  # or a whole named visit, e.g. "strep" (office visit + strep test, with a total)
    setting: str = Field("office", max_length=40)
    zip_code: str = Field("21252", pattern=ZIP_CODE)
    new_patient: bool = True  # only used with visit: picks the new or returning office visit code
    clinic: Optional[str] = Field(None, max_length=200)  # a clinic id from GET /clinics, for that clinic's own price level


@api.post("/estimate")
def estimate_endpoint(req: EstimateRequest):
    """Price range for one service, or for a named visit when `visit` is sent."""
    if req.visit:
        result = estimate_visit(req.visit, req.setting, req.zip_code, req.new_patient, req.clinic)
    elif req.service_code:
        result = estimate(req.service_code, req.setting, req.zip_code, req.clinic)
    else:
        raise HTTPException(status_code=400, detail="Send a service_code or a visit.")
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@api.get("/clinics")
def clinics_endpoint(
    service_code: str = Query(..., pattern=SERVICE_CODE),
    zip_code: str = Query("21252", pattern=ZIP_CODE),
    limit: int = Query(5, ge=1, le=10),
):
    """Known clinics near a ZIP with their price range for a service, cheapest first."""
    result = nearby_clinics(service_code, zip_code, limit)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@api.get("/services")
def services_endpoint():
    """The services and named visits the cost model can price, for the app's menus."""
    return service_menu()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    patient_id: str = Field(pattern=PATIENT_ID)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    # The backend sends the signed-in patient's records from its database.
    # If left out (handy when trying this service on its own), we use the
    # synthetic sample records in data/sample_records.json.
    records: Optional[list[dict]] = Field(None, max_length=200)


@api.post("/chat")
def chat_endpoint(req: ChatRequest):
    """Message in -> reply out, plus which records and estimates the answer used."""
    patient_records = req.records if req.records is not None else store.get_records(req.patient_id)
    if len(json.dumps(patient_records)) > MAX_RECORDS_BYTES:
        raise HTTPException(status_code=413, detail="Too many records to read at once.")
    history = [m.model_dump() for m in req.history]
    try:
        return chat(req.message, patient_records, history)
    except Exception:
        log.exception("Companion failed")
        raise HTTPException(status_code=502, detail="The companion could not answer right now.")


app.include_router(api)
