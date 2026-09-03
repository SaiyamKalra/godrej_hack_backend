const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "llama3.2:latest";

interface OllamaMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

interface OllamaStreamChunk {
  message?: {
    role: string;
    content: string;
  };
  done?: boolean;
}

export async function streamResponse(
  messages: OllamaMessage[],
  onChunk?: (content: string) => void
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed: ${response.status} ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("Ollama response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines = buffer.split("\n");

    // Keep the incomplete line for the next chunk
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const chunk = JSON.parse(line) as OllamaStreamChunk;

      const content = chunk.message?.content;

      if (content) {
        fullResponse += content;

        if (onChunk) {
          onChunk(content);
        }
      }
    }
  }

  // Process anything remaining in buffer
  if (buffer.trim()) {
    const chunk = JSON.parse(buffer) as OllamaStreamChunk;

    const content = chunk.message?.content;

    if (content) {
      fullResponse += content;
      if (onChunk) {
        onChunk(content);
      }
    }
  }

  return fullResponse;
}