"""Document reader: a photo or PDF of medical paperwork becomes a structured record.

How it works: we send the image to Claude along with a "save_record" tool and
force Claude to call that tool. The tool's input schema is the exact JSON shape
we want, so we always get clean, structured fields back instead of free text.
"""
import base64
import json
from datetime import date
from io import BytesIO

from PIL import Image, ImageOps

from llm import MOCK_MODE, call_llm

# Lets Pillow open iPhone HEIC photos
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

MAX_SIDE = 1568  # pixels; bigger photos are shrunk so they stay under the API's size limit

DOC_TYPES = [
    "visit_summary", "lab_result", "immunization_record",
    "prescription", "physical_form", "insurance_card", "other",
]

SAVE_RECORD_TOOL = {
    "name": "save_record",
    "description": "Save the structured contents of one medical document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": DOC_TYPES},
            "date": {"type": "string", "description": "Date of the visit or document, YYYY-MM-DD, or empty if not shown"},
            "provider": {"type": "string", "description": "Clinic, hospital or clinician name"},
            "fields": {
                "type": "object",
                "description": "Key facts as short label/value pairs, e.g. diagnosis, tests, results, vaccines and dates, medications, follow-up",
                "additionalProperties": {"type": "string"},
            },
            "summary": {"type": "string", "description": "2-3 sentence plain-language summary a college student would understand"},
        },
        "required": ["type", "date", "provider", "fields", "summary"],
    },
}

PROMPT = (
    "This is a photo or scan of a patient's medical paperwork. "
    "Read it and call the save_record tool with what it says. Always call save_record, even if the "
    "page is hard to read or isn't medical; then use type 'other'. "
    "Only include facts that are actually on the page. Do not guess or diagnose. "
    "If something is unreadable, leave it out."
)

def prepare_image(file_bytes):
    """Open any photo (JPG, PNG, HEIC...), fix its rotation, shrink it and save it as JPEG."""
    try:
        img = Image.open(BytesIO(file_bytes))
    except Exception:
        raise ValueError("Couldn't open that file as an image. Use a photo (JPG, PNG, HEIC) or a PDF.")
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = BytesIO()
    img.save(out, "JPEG", quality=85)
    return out.getvalue()


def extract_document(file_bytes, media_type):
    is_pdf = media_type == "application/pdf" or file_bytes[:4] == b"%PDF"
    if not is_pdf:
        file_bytes = prepare_image(file_bytes)  # also rejects files that aren't images
    if MOCK_MODE:
        return _mock_record()

    if is_pdf:
        data = base64.standard_b64encode(file_bytes).decode()
        file_block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
    else:
        data = base64.standard_b64encode(file_bytes).decode()
        file_block = {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}

    # Some models don't allow forcing a tool, so we ask for it in the prompt instead
    response = call_llm(
        messages=[{"role": "user", "content": [file_block, {"type": "text", "text": PROMPT}]}],
        tools=[SAVE_RECORD_TOOL],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_record":
            return block.input

    # Backup: if the model answered in text, try to pull a JSON object out of it
    text = "".join(b.text for b in response.content if b.type == "text")
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise RuntimeError("The model did not return a record. It said: " + text[:300])


def _mock_record():
    return {
        "type": "visit_summary",
        "date": date.today().isoformat(),
        "provider": "Towson Campus Health Center (MOCK)",
        "fields": {
            "reason_for_visit": "Sore throat, fever",
            "tests": "Rapid strep test (87880)",
            "result": "Positive for strep",
            "medication": "Amoxicillin 500 mg, twice a day for 10 days",
            "follow_up": "Return if not better in 48 hours",
        },
        "summary": "MOCK: You were seen for a sore throat. The rapid strep test was positive, "
        "so you were prescribed an antibiotic for 10 days.",
    }
