"""AI service: three endpoints the web app calls.

Run it:  uvicorn main:app --reload --port 8000
Try it:  open http://localhost:8000/docs  (FastAPI makes a test page for every endpoint)
"""
import traceback
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import records as store
from companion import chat
from estimate_stub import estimate
from extract import extract_document
from llm import MOCK_MODE, MODEL

app = FastAPI(title="Health companion AI service")

# Let the Next.js app (another port / domain) call this service
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "mock_mode": MOCK_MODE, "model": None if MOCK_MODE else MODEL}


@app.post("/extract")
async def extract_endpoint(file: UploadFile = File(...), patient_id: Optional[str] = Form(None)):
    """Photo or PDF in -> structured record out. If patient_id is sent, the record is also saved."""
    file_bytes = await file.read()
    try:
        record = extract_document(file_bytes, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # e.g. an API error: show the real reason instead of "Internal Server Error"
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {e}")
    if patient_id:
        record = store.add_record(patient_id, record)
    return record


class EstimateRequest(BaseModel):
    service_code: str
    setting: str = "office"
    zip_code: str = "21252"


@app.post("/estimate")
def estimate_endpoint(req: EstimateRequest):
    """Owned by the cost-model person (workstream D). Uses placeholder numbers for now."""
    return estimate(req.service_code, req.setting, req.zip_code)


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    patient_id: str
    history: list[ChatMessage] = []
    # Optional: the web app can send the patient's records from its own database.
    # If left out, we use the records saved in data/sample_records.json.
    records: Optional[list[dict]] = None


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """Message in -> reply out, plus which records and estimates the answer used."""
    patient_records = req.records if req.records is not None else store.get_records(req.patient_id)
    history = [m.model_dump() for m in req.history]
    return chat(req.message, patient_records, history)


@app.get("/records/{patient_id}")
def list_records(patient_id: str):
    """Handy for testing: see what's saved for a patient."""
    return store.get_records(patient_id)
