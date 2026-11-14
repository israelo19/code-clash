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
from estimate_stub import estimate, estimate_visit, nearby_clinics, service_menu
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


# ---- Cost estimates, owned by the cost-model person (workstream D). Numbers come from the trained model.


class EstimateRequest(BaseModel):
    service_code: Optional[str] = None  # one service, e.g. "87880"
    visit: Optional[str] = None  # or a whole named visit, e.g. "strep" (office visit + strep test, with a total)
    setting: str = "office"
    zip_code: str = "21252"
    new_patient: bool = True  # only used with visit: picks the new or returning office visit code
    clinic: Optional[str] = None  # a clinic id from GET /clinics, for that clinic's own price level


@app.post("/estimate")
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


@app.get("/clinics")
def clinics_endpoint(service_code: str, zip_code: str = "21252", limit: int = 5):
    """Known clinics near a ZIP with their price range for a service, cheapest first."""
    result = nearby_clinics(service_code, zip_code, limit)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/services")
def services_endpoint():
    """The services and named visits the cost model can price, for the app's menus."""
    return service_menu()


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


@app.post("/reset")
def reset_records():
    """Before a demo run: remove uploaded documents and go back to the starting records."""
    return {"reset": True, "records_per_patient": store.reset()}


@app.get("/records/{patient_id}")
def list_records(patient_id: str):
    """Handy for testing: see what's saved for a patient."""
    return store.get_records(patient_id)
