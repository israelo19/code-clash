"""The companion: a chat agent with two tools.

  search_records  -> looks through the patient's own records
  estimate_cost   -> gets a price range from the cost model

The "agent loop": we send the message to Claude with the tool list. If Claude
decides it needs a tool, it replies with a tool_use request instead of text.
We run that tool ourselves in Python, send back the result, and repeat until
Claude replies with a normal text answer.
"""
import json

from estimate_stub import SERVICES, estimate
from llm import MOCK_MODE, call_llm
from records import search_records

SYSTEM_PROMPT = f"""You are a friendly health-paperwork companion for college students and young adults
who are managing their own healthcare for the first time.

What you do:
- Explain the user's own medical documents in plain language.
- Help them understand what care might cost before they go, using the estimate_cost tool.
- Tell them which records to bring to a visit or a school/job form.

Rules you must always follow:
- You are NOT a doctor. Never diagnose, and never tell someone what condition they have or what treatment to take.
- When you use a record, say which one (type, provider and date), for example "From your visit summary at Campus Health on 2026-10-02".
- Cost numbers are always an estimate range, never a quote, and not what their insurance will pay. Say so.
- If the user describes urgent symptoms (trouble breathing, chest pain, severe bleeding, thoughts of self-harm,
  a very high fever, a stiff neck with fever, fainting), tell them to call 911 or go to the ER now, before anything else.
- Keep answers short: a few sentences or a short list.
- Write plain text only. The app shows your answer exactly as typed and cannot display Markdown.
  So no tables, no headings, and no asterisks for bold. For a list, start each line with "- ".

Service codes you can estimate (pick the ones that fit what the user describes; a visit usually
needs the office visit code plus any test):
{json.dumps(SERVICES, indent=2)}
Setting is "office" (campus clinic, doctor's office, retail clinic) or "facility" (hospital-based clinic, ER).
"""

TOOLS = [
    {
        "name": "search_records",
        "description": "Search the user's saved medical records (visit summaries, lab results, immunizations, etc.). "
        "Use it whenever the question is about their own history, results or paperwork.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Keywords, e.g. 'immunization MMR' or 'strep test'"}},
            "required": ["query"],
        },
    },
    {
        "name": "estimate_cost",
        "description": "Get an estimated price range (low, typical, high) for one medical service in Maryland.",
        "input_schema": {
            "type": "object",
            "properties": {
                "service_code": {"type": "string", "enum": list(SERVICES.keys())},
                "setting": {"type": "string", "enum": ["office", "facility"]},
                "zip_code": {"type": "string", "description": "User's ZIP code if known, otherwise 21252 (Towson)"},
            },
            "required": ["service_code"],
        },
    },
]


def run_tool(name, tool_input, records, used):
    """Run one tool Claude asked for, and remember what was used (so the UI can show sources)."""
    if name == "search_records":
        found = search_records(records, tool_input.get("query", ""))
        used["records"].extend(r.get("id") for r in found if r.get("id") not in used["records"])
        return found or "No matching records found."
    if name == "estimate_cost":
        result = estimate(
            tool_input["service_code"],
            tool_input.get("setting", "office"),
            tool_input.get("zip_code", "21252"),
        )
        used["estimates"].append(result)
        return result
    return f"Unknown tool {name}"


def chat(message, records, history=None):
    """Answer one user message. history is a list of {"role": "user"|"assistant", "content": "..."}."""
    used = {"records": [], "estimates": []}

    if MOCK_MODE:
        return _mock_chat(message, records, used)

    messages = list(history or []) + [{"role": "user", "content": message}]
    response = call_llm(messages, system=SYSTEM_PROMPT, tools=TOOLS)

    # The agent loop: keep going while Claude is asking for tools (max 5 rounds as a safety limit)
    for _ in range(5):
        if response.stop_reason != "tool_use":
            break
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                output = run_tool(block.name, block.input, records, used)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(output),
                })
        messages.append({"role": "user", "content": tool_results})
        response = call_llm(messages, system=SYSTEM_PROMPT, tools=TOOLS)

    reply = "".join(block.text for block in response.content if block.type == "text")
    return {"reply": reply, "used_records": used["records"], "used_estimates": used["estimates"]}


def _mock_chat(message, records, used):
    """Fake answers with no API key, so the front end can be built and tested."""
    text = message.lower()
    if any(w in text for w in ["cost", "price", "how much", "strep", "throat"]):
        visit = run_tool("estimate_cost", {"service_code": "99213"}, records, used)
        test = run_tool("estimate_cost", {"service_code": "87880"}, records, used)
        reply = (
            f"(MOCK) An office visit is usually about ${visit['low']} to ${visit['high']}, "
            f"and a rapid strep test about ${test['low']} to ${test['high']}. "
            "These are estimates, not quotes. I'm not a doctor; a clinician can tell you if it's strep."
        )
    else:
        found = run_tool("search_records", {"query": message}, records, used)
        if isinstance(found, list) and found:
            r = found[0]
            reply = f"(MOCK) From your {r.get('type')} at {r.get('provider')} on {r.get('date')}: {r.get('summary')}"
        else:
            reply = "(MOCK) I couldn't find a record about that. Try uploading the document first."
    return {"reply": reply, "used_records": used["records"], "used_estimates": used["estimates"]}
