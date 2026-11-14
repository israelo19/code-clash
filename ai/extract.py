"""Document reader: a photo or PDF of medical paperwork becomes a structured record.

How it works: we send the image to Claude along with a "save_record" tool and
force Claude to call that tool. The tool's input schema is the exact JSON shape
we want, so we always get clean, structured fields back instead of free text.
"""
import base64
from datetime import date

from llm import MOCK_MODE, call_llm

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
    "Read it and call save_record with what it says. "
    "Only include facts that are actually on the page. Do not guess or diagnose. "
    "If something is unreadable, leave it out."
)

SUPPORTED_IMAGES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def extract_document(file_bytes, media_type):
    if media_type != "application/pdf" and media_type not in SUPPORTED_IMAGES:
        raise ValueError(f"Unsupported file type: {media_type}. Use JPG, PNG, WEBP, GIF or PDF.")
    if MOCK_MODE:
        return _mock_record()

    data = base64.standard_b64encode(file_bytes).decode()
    if media_type == "application/pdf":
        file_block = {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": data}}
    else:
        file_block = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}

    response = call_llm(
        messages=[{"role": "user", "content": [file_block, {"type": "text", "text": PROMPT}]}],
        tools=[SAVE_RECORD_TOOL],
        tool_choice={"type": "tool", "name": "save_record"},  # forces structured output
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input
    raise RuntimeError("The model did not return a record.")


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
