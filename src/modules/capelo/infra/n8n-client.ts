import { config } from "../../../infra/config/env";

export class CapeloTimeoutError extends Error {
  constructor() {
    super("Capelo demorou para responder");
    this.name = "CapeloTimeoutError";
  }
}
export class CapeloNetworkError extends Error {
  constructor(cause?: unknown) {
    super("Falha de rede ao contatar o Capelo");
    this.name = "CapeloNetworkError";
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}
export class CapeloHttpError extends Error {
  constructor(public status: number) {
    super(`Capelo retornou status ${status}`);
    this.name = "CapeloHttpError";
  }
}
export class CapeloEmptyReplyError extends Error {
  constructor() {
    super("Capelo retornou resposta vazia");
    this.name = "CapeloEmptyReplyError";
  }
}
export class CapeloWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapeloWorkflowError";
  }
}

const TEXT_KEYS = [
  "output",
  "text",
  "message",
  "response",
  "answer",
  "reply",
  "content",
  "delta",
  "chunk",
  "result",
] as const;

const ERROR_KEYS = ["error", "errors", "stack", "code", "hint", "details"] as const;

function preview(value: string, max = 500): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function describeShape(data: unknown): {
  topLevelKeys: string[];
  types: Record<string, string>;
  isArray: boolean;
  size: number;
} {
  if (Array.isArray(data)) {
    return { topLevelKeys: [], types: {}, isArray: true, size: data.length };
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const types: Record<string, string> = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      types[k] = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
    }
    return { topLevelKeys: Object.keys(obj), types, isArray: false, size: Object.keys(obj).length };
  }
  return { topLevelKeys: [], types: {}, isArray: false, size: 0 };
}

function extractReply(data: unknown, depth = 0): string {
  if (data == null || depth > 4) return "";
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data)) {
    for (const item of data) {
      const r = extractReply(item, depth + 1);
      if (r) return r;
    }
    return "";
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    // Try nested known wrappers first (json, data, response, output, message)
    for (const key of ["json", "data", "response", "output", "message", "result"]) {
      const v = obj[key];
      if (v && typeof v === "object") {
        const r = extractReply(v, depth + 1);
        if (r) return r;
      }
    }
    // Generic recursion
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        const r = extractReply(v, depth + 1);
        if (r) return r;
      }
    }
  }
  return "";
}

function looksLikeWorkflowError(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  const hasErrorSignal = ERROR_KEYS.some((k) => obj[k] != null);
  if (!hasErrorSignal) return null;
  const candidates: unknown[] = [
    obj.message,
    (obj.error as Record<string, unknown> | undefined)?.message,
    obj.hint,
    obj.code,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim().slice(0, 300);
  }
  return "Workflow error";
}

interface N8nStreamResult {
  reply: string;
  cycles: number;
  items: number;
  droppedEmptyCycles: number;
  errored: boolean;
}

/**
 * Parse a stream of concatenated JSON objects emitted by the n8n AI Agent
 * (begin/item/keepalive/end), even when Content-Type is application/json.
 * Returns the text of the LAST cycle that produced at least one item.
 * Throws CapeloWorkflowError on `type: "error"`.
 */
function parseN8nItemStream(raw: string): N8nStreamResult {
  const objects: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = raw.slice(start, i + 1);
        try {
          const obj = JSON.parse(slice);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            objects.push(obj as Record<string, unknown>);
          }
        } catch { /* skip malformed slice */ }
        start = -1;
      }
    }
  }

  let cycles = 0;
  let items = 0;
  let droppedEmptyCycles = 0;
  let currentBuf = "";
  let currentItems = 0;
  let lastNonEmpty = "";
  let inCycle = false;

  for (const obj of objects) {
    const type = typeof obj.type === "string" ? (obj.type as string).toLowerCase() : "";
    if (type === "error") {
      const msg =
        (obj as { error?: { message?: string } }).error?.message ??
        (typeof obj.message === "string" ? obj.message : "Workflow error");
      throw new CapeloWorkflowError(String(msg).slice(0, 300));
    }
    if (type === "begin") {
      if (inCycle && currentItems === 0) droppedEmptyCycles++;
      cycles++;
      currentBuf = "";
      currentItems = 0;
      inCycle = true;
      continue;
    }
    if (type === "item") {
      const c = obj.content;
      if (typeof c === "string") {
        currentBuf += c;
        currentItems++;
        items++;
      }
      continue;
    }
    if (type === "end") {
      if (currentItems > 0) lastNonEmpty = currentBuf;
      else if (inCycle) droppedEmptyCycles++;
      inCycle = false;
      currentBuf = "";
      currentItems = 0;
      continue;
    }
    // keepalive and unknown types: ignore
  }
  // Trailing cycle without end
  if (inCycle && currentItems > 0) lastNonEmpty = currentBuf;

  return { reply: lastNonEmpty.trim(), cycles, items, droppedEmptyCycles, errored: false };
}

function looksLikeItemStream(raw: string): boolean {
  const head = raw.slice(0, 200).replace(/\s+/g, "");
  return /^\{"type":"(begin|item|keepalive|end|error)"/.test(head);
}

function extractChunkText(obj: Record<string, unknown>): string {
  for (const key of TEXT_KEYS) {
    const v = obj[key];
    if (typeof v === "string") return v;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const nested = extractChunkText(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return "";
}

async function parseStreamingBody(res: Response, kind: "sse" | "ndjson"): Promise<{ reply: string; chunks: number }> {
  if (!res.body) return { reply: "", chunks: 0 };
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let acc = "";
  let chunks = 0;
  let ended = false;

  const processLine = (line: string) => {
    if (ended) return;
    let payload = line;
    if (kind === "sse") {
      if (!payload || payload.startsWith(":")) return;
      if (!payload.startsWith("data:")) return;
      payload = payload.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        if (payload === "[DONE]") ended = true;
        return;
      }
    } else {
      payload = payload.trim();
      if (!payload) return;
    }
    chunks += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      acc += payload;
      return;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type.toLowerCase() : "";
      if (type === "end" || type === "done" || type === "final" || type === "complete") {
        ended = true;
        const tail = extractChunkText(obj);
        if (tail) acc += tail;
        return;
      }
      if (type === "error") {
        throw new CapeloHttpError(502);
      }
      const piece = extractChunkText(obj);
      if (piece) acc += piece;
      return;
    }
    if (typeof parsed === "string") acc += parsed;
  };

  try {
    while (!ended) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          processLine(line);
          if (ended) break;
        }
      }
      if (done) {
        buffer += decoder.decode();
        if (buffer.length) {
          for (const line of buffer.split(/\r?\n/)) processLine(line);
          buffer = "";
        }
        break;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
  return { reply: acc.trim(), chunks };
}

export interface SendChatParams {
  chatInput: string;
  sessionId: string;
  userId: string;
}

const TIMEOUT_MS = 500_000;

export async function sendChat(params: SendChatParams): Promise<string> {
  const url = config.n8nCapeloUrl;
  if (!url) throw new CapeloNetworkError(new Error("N8N_CAPELO_URL não configurado"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream, application/json;q=0.9, */*;q=0.5" },
      // Send aliases so n8n nodes that expect `input`/`message` also work.
      body: JSON.stringify({
        ...params,
        input: params.chatInput,
        message: params.chatInput,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as { name?: string }).name === "AbortError") throw new CapeloTimeoutError();
    // eslint-disable-next-line no-console
    console.error("[capelo] network error", { url, code: (err as { code?: string }).code });
    throw new CapeloNetworkError(err);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("[capelo] http error", { url, status: res.status });
    throw new CapeloHttpError(res.status);
  }

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  let reply = "";
  let rawForLog = "";
  let parsedForLog: unknown = undefined;

  try {
    if (ct.includes("text/event-stream")) {
      const { reply: r, chunks } = await parseStreamingBody(res, "sse");
      reply = r;
      // eslint-disable-next-line no-console
      console.log("[capelo] stream response", { contentType: ct, kind: "sse", chunks, replyLength: reply.length });
    } else if (ct.includes("ndjson") || ct.includes("jsonl")) {
      const { reply: r, chunks } = await parseStreamingBody(res, "ndjson");
      reply = r;
      // eslint-disable-next-line no-console
      console.log("[capelo] stream response", { contentType: ct, kind: "ndjson", chunks, replyLength: reply.length });
    } else if (ct.includes("application/json")) {
      rawForLog = await res.text();
      let parsed: unknown;
      let parseOk = false;
      try {
        parsed = JSON.parse(rawForLog);
        parseOk = true;
      } catch { /* will try stream parser below */ }

      if (parseOk) {
        parsedForLog = parsed;
        const shape = describeShape(parsed);
        // eslint-disable-next-line no-console
        console.log("[capelo] json response", {
          contentType: ct,
          status: res.status,
          length: rawForLog.length,
          isArray: shape.isArray,
          topLevelKeys: shape.topLevelKeys,
          types: shape.types,
        });
        const workflowErr = looksLikeWorkflowError(parsed);
        reply = extractReply(parsed);
        if (!reply && workflowErr) {
          throw new CapeloWorkflowError(workflowErr);
        }
      }

      // Fallback: concatenated JSON object stream from n8n AI Agent.
      if (!reply && looksLikeItemStream(rawForLog)) {
        const r = parseN8nItemStream(rawForLog);
        reply = r.reply;
        // eslint-disable-next-line no-console
        console.log("[capelo] n8n stream", {
          contentType: ct,
          cycles: r.cycles,
          items: r.items,
          droppedEmptyCycles: r.droppedEmptyCycles,
          replyLength: reply.length,
        });
      } else if (!parseOk) {
        // eslint-disable-next-line no-console
        console.error("[capelo] invalid json", {
          contentType: ct,
          length: rawForLog.length,
          preview: preview(rawForLog),
        });
        throw new CapeloEmptyReplyError();
      }
    } else {
      const text = await res.text();
      rawForLog = text;
      if (text.includes("data:")) {
        let acc = "";
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed && typeof parsed === "object") {
              acc += extractChunkText(parsed as Record<string, unknown>);
            } else if (typeof parsed === "string") {
              acc += parsed;
            }
          } catch {
            acc += payload;
          }
        }
        reply = acc.trim() || text.trim();
      } else {
        reply = text.trim();
      }
      // eslint-disable-next-line no-console
      console.log("[capelo] text response", { contentType: ct, length: text.length, replyLength: reply.length });
    }
  } catch (err) {
    if (err instanceof CapeloHttpError) throw err;
    if (err instanceof CapeloWorkflowError) throw err;
    if (err instanceof CapeloEmptyReplyError) throw err;
    // eslint-disable-next-line no-console
    console.error("[capelo] parse error", { url, contentType: ct, message: (err as Error).message });
    throw new CapeloEmptyReplyError();
  }

  if (!reply.trim()) {
    // eslint-disable-next-line no-console
    console.error("[capelo] empty reply", {
      url,
      contentType: ct,
      length: rawForLog.length,
      ...(parsedForLog !== undefined ? { shape: describeShape(parsedForLog) } : {}),
    });
    throw new CapeloEmptyReplyError();
  }
  return reply;
}
