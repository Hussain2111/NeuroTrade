import os
import requests

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


def chat(messages, model=None, timeout=30):
    """Send a chat completion request to Groq (OpenAI-compatible API).

    `messages` is a list of {"role": ..., "content": ...} dicts, the same
    shape the code previously passed to ollama.chat(). Returns the
    assistant's reply text, or raises on failure (callers already wrap
    this in their own error handling).
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    response = requests.post(
        GROQ_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={"model": model or DEFAULT_MODEL, "messages": messages},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]
