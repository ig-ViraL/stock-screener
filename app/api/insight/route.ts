import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getCachedInsight, setCachedInsight } from "@/lib/insight-cache";

const bodySchema = z.object({
  symbol: z.string().min(1).max(10),
  name: z.string().min(1),
  price: z.number(),
  change: z.number(),
  percentChange: z.number(),
  marketCap: z.number(),
  industry: z.string(),
  metrics: z
    .object({
      peRatio: z.number().optional(),
      eps: z.number().optional(),
      beta: z.number().optional(),
      dividendYield: z.number().optional(),
      roe: z.number().optional(),
      debtToEquity: z.number().optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `You are a senior equity analyst writing a brief market commentary. Given structured stock data, produce exactly 2–3 sentences of analyst-style insight. Be specific, reference the numbers provided, and highlight what the data suggests about momentum, valuation, or risk. Do not add disclaimers or caveats. Do not use markdown formatting.`;

function buildUserPrompt(data: z.infer<typeof bodySchema>): string {
  const direction = data.change >= 0 ? "up" : "down";
  let prompt = `${data.name} (${data.symbol}) — ${data.industry}\nPrice: $${data.price.toFixed(2)} (${direction} ${Math.abs(data.percentChange).toFixed(2)}% today)\nMarket Cap: $${(data.marketCap * 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  if (data.metrics) {
    const m = data.metrics;
    const parts: string[] = [];
    if (m.peRatio !== undefined) parts.push(`P/E: ${m.peRatio.toFixed(1)}`);
    if (m.eps !== undefined) parts.push(`EPS: $${m.eps.toFixed(2)}`);
    if (m.beta !== undefined) parts.push(`Beta: ${m.beta.toFixed(2)}`);
    if (m.dividendYield !== undefined)
      parts.push(`Div Yield: ${m.dividendYield.toFixed(2)}%`);
    if (m.roe !== undefined) parts.push(`ROE: ${m.roe.toFixed(1)}%`);
    if (m.debtToEquity !== undefined)
      parts.push(`D/E: ${m.debtToEquity.toFixed(1)}`);
    if (parts.length > 0) prompt += `\nKey Metrics: ${parts.join(", ")}`;
  }

  return prompt;
}

async function streamWithAnthropic(
  data: z.infer<typeof bodySchema>,
  apiKey: string,
): Promise<Response> {
  const client = new Anthropic({ apiKey });
  const symbol = data.symbol;

  let accumulated = "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(data) }],
        });

        for await (const chunk of response) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            accumulated += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        if (accumulated) {
          setCachedInsight(symbol, accumulated);
        }
        controller.close();
      } catch {
        controller.error(new Error("Stream interrupted"));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Insight-Cached": "false",
    },
  });
}

async function streamWithOpenAI(
  data: z.infer<typeof bodySchema>,
  apiKey: string,
): Promise<Response> {
  const openai = new OpenAI({ apiKey });
  const symbol = data.symbol;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 200,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(data) },
    ],
  });

  let accumulated = "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            accumulated += content;
            controller.enqueue(encoder.encode(content));
          }
        }
        if (accumulated) {
          setCachedInsight(symbol, accumulated);
        }
        controller.close();
      } catch {
        controller.error(new Error("Stream interrupted"));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Insight-Cached": "false",
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { symbol } = parsed.data;

  const cached = getCachedInsight(symbol);
  if (cached) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(cached));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Insight-Cached": "true",
      },
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return NextResponse.json(
      { error: "AI service not yet setup" },
      { status: 500 },
    );
  }

  try {
    if (anthropicKey) {
      return await streamWithAnthropic(parsed.data, anthropicKey);
    } else {
      return await streamWithOpenAI(parsed.data, openaiKey!);
    }
  } catch (err) {
    console.error("AI service error:", err);
    return NextResponse.json(
      { error: "AI service temporarily unavailable" },
      { status: 502 },
    );
  }
}
