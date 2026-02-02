// SpaceMolt LLM Clients
// These serve as defaults - can be overridden at runtime via ClientRegistry

// Ollama (local)
client<llm> Ollama {
  provider openai-generic
  options {
    base_url "http://localhost:11434/v1"
    model "llama3.2"
    api_key ""
  }
}

// Groq (fast inference)
client<llm> Groq {
  provider openai-generic
  options {
    base_url "https://api.groq.com/openai/v1"
    model "llama-3.3-70b-versatile"
    api_key env.GROQ_API_KEY
  }
}

// OpenAI
client<llm> OpenAI {
  provider openai
  options {
    model "gpt-4o"
    api_key env.OPENAI_API_KEY
  }
}

// Anthropic Claude
client<llm> Claude {
  provider anthropic
  options {
    model "claude-sonnet-4-20250514"
    api_key env.ANTHROPIC_API_KEY
  }
}

// Google Gemini
client<llm> Gemini {
  provider google-ai
  options {
    model "gemini-2.0-flash"
    api_key env.GOOGLE_API_KEY
  }
}

// Retry policy for transient failures
retry_policy StandardRetry {
  max_retries 2
  strategy {
    type exponential_backoff
    delay_ms 500
    multiplier 2
    max_delay_ms 5000
  }
}
