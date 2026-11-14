"""One place that talks to the LLM API.

If you switch providers later, this is the only file that has to change.
If there is no API key, MOCK_MODE is True and the other files return fake
answers instead of calling the API.
"""
import os

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
MOCK_MODE = not API_KEY

client = None
if not MOCK_MODE:
    import anthropic

    client = anthropic.Anthropic(api_key=API_KEY)


def call_llm(messages, system=None, tools=None, tool_choice=None, max_tokens=1500):
    """Send one request to Claude and return the raw response."""
    kwargs = {"model": MODEL, "max_tokens": max_tokens, "messages": messages}
    if system:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice
    return client.messages.create(**kwargs)
