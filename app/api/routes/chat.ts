import { Hono } from "hono";

const SENSENOVA_BASE_URL = "https://token.sensenova.cn/v1";

const chatRouter = new Hono();

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface IntentResult {
  needs_image: boolean;
  image_prompt?: string;
  category: "coding" | "creative" | "factual" | "reasoning" | "general";
  suggested_tone: "technical" | "casual" | "professional" | "friendly";
}

function getApiKey(c: any): string | null {
  const header = c.req.header("x-api-key");
  if (header && header.startsWith("sk-")) return header;
  return null;
}

async function analyzeIntent(
  messages: ChatMessage[],
  apiKey: string,
): Promise<IntentResult> {
  const res = await fetch(`${SENSENOVA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sensenova-6.7-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "你是一个意图分析专家。请分析用户输入，输出JSON，包含：needs_image(是否需要生成图片), image_prompt(如果需要图片，给U1模型的英文提示词), category(分类:coding/creative/factual/reasoning/general), suggested_tone(语气:technical/casual/professional/friendly)。只输出JSON，不要其他文字。",
        },
        ...messages,
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.3,
      reasoning_effort: "none",
    }),
  });

  if (!res.ok) {
    return { needs_image: false, category: "general", suggested_tone: "friendly" };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as IntentResult;
  } catch {
    return { needs_image: false, category: "general", suggested_tone: "friendly" };
  }
}

async function* parseSSE(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          yield json;
        } catch {
          // ignore
        }
      }
    }
  }
}

function createUnifiedStream(
  messages: ChatMessage[],
  intent: IntentResult,
  apiKey: string,
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ type: "thinking", message: "正在分析需求并协调多模型..." });

      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const toneMap: Record<string, string> = {
        technical: "你是技术专家，回答精确、严谨，善用代码和术语。",
        casual: "你是轻松友好的助手，回答自然口语化。",
        professional: "你是专业顾问，回答正式、有条理、可执行。",
        friendly: "你是温暖耐心的助手，回答亲切易懂。",
      };

      const categoryMap: Record<string, string> = {
        coding: "用户问题涉及编程/代码，请提供可运行的代码示例和详细解释。",
        creative: "用户问题需要创意/创作，请提供丰富想象力、细节和情感的内容。",
        factual: "用户问题需要事实/知识，请确保信息准确、引用可靠。",
        reasoning: "用户问题需要深度推理/分析，请展示完整思考链条和逻辑推导。",
        general: "请给出全面、有帮助的回答。",
      };

      const systemPrompt = `你是SenseNova混合智能助手，由Flash-Lite（快速分析师）辅助分析用户需求。

分析结论：
- 问题类型：${categoryMap[intent.category] || categoryMap.general}
- 语气风格：${toneMap[intent.suggested_tone] || toneMap.friendly}

请给出一条完整、流畅、可直接使用的最终回答。`;

      const deepSeekBody = JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      });

      const tasks: Promise<void>[] = [];

      tasks.push(
        fetch(`${SENSENOVA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: deepSeekBody,
        }).then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            send({ type: "error", error: err });
            return;
          }
          const reader = res.body!.getReader();
          for await (const chunk of parseSSE(reader)) {
            const delta = chunk.choices?.[0]?.delta;
            const finish = chunk.choices?.[0]?.finish_reason;
            if (delta?.content) {
              send({ type: "token", content: delta.content });
            }
            if (delta?.reasoning_content) {
              send({ type: "reasoning", content: delta.reasoning_content });
            }
            if (finish) {
              send({ type: "finish", finishReason: finish });
            }
          }
        }).catch((e) => {
          send({ type: "error", error: String(e) });
        })
      );

      if (intent.needs_image && intent.image_prompt) {
        tasks.push(
          fetch(`${SENSENOVA_BASE_URL}/images/generations`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: "sensenova-u1-fast",
              prompt: intent.image_prompt,
              size: "2048x2048",
              n: 1,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              send({ type: "error", error: err, source: "u1" });
              return;
            }
            const data = await res.json() as { data?: Array<{ url?: string }> };
            const url = data.data?.[0]?.url;
            if (url) {
              send({ type: "image", url });
            }
          }).catch((e) => {
            send({ type: "error", error: String(e), source: "u1" });
          })
        );
      }

      await Promise.all(tasks);
      send({ type: "done" });
      controller.close();
    },
  });
}

chatRouter.post("/stream", async (c) => {
  const apiKey = getApiKey(c);
  if (!apiKey) {
    return c.json({ error: "请提供有效的 SenseNova API Key（Header: x-api-key）" }, 401);
  }

  const body = await c.req.json<{ messages: ChatMessage[] }>();
  const messages = body.messages || [];

  const intent = await analyzeIntent(messages, apiKey);
  const stream = createUnifiedStream(messages, intent, apiKey);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

export default chatRouter;
