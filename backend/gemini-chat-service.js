/**
 * Google Gemini (Google AI Studio) — server-side only.
 * backend/.env: GEMINI_API_KEY=...  optional: GEMINI_MODEL=gemini-2.5-flash-lite
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MESSAGE = 8000;

const SYSTEM_INSTRUCTION = `You are SmartDive's text assistant for recreational scuba diving, especially in New Zealand: dive sites, planning, gear, and conditions at a high level.
Keep answers concise and practical. Never present model output as professional medical or legal advice.
For decompression illness, emergencies, or certification-level decisions, tell the user to contact emergency services, a doctor, or a certified instructor and local dive operator.`;

async function generateChatReply(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error("GEMINI_API_KEY is not configured");
    err.statusCode = 503;
    throw err;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error("messages must be a non-empty array");
    err.statusCode = 400;
    throw err;
  }

  if (messages.length > MAX_MESSAGES) {
    const err = new Error(`At most ${MAX_MESSAGES} messages allowed`);
    err.statusCode = 400;
    throw err;
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    const err = new Error("Last message must have role user");
    err.statusCode = 400;
    throw err;
  }

  const modelName = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const history = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    const text = String(m.content ?? "").slice(0, MAX_CHARS_PER_MESSAGE);
    if (!text.trim()) continue;
    const role =
      m.role === "assistant" || m.role === "model" ? "model" : "user";
    if (role === "model" && history.length === 0) continue;
    history.push({ role, parts: [{ text }] });
  }

  const lastText = String(last.content ?? "")
    .slice(0, MAX_CHARS_PER_MESSAGE)
    .trim();
  if (!lastText) {
    const err = new Error("Message content is required");
    err.statusCode = 400;
    throw err;
  }

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastText);
  const out = result.response?.text?.();
  if (!out || !String(out).trim()) {
    const err = new Error("Empty response from model");
    err.statusCode = 502;
    throw err;
  }
  return String(out);
}

module.exports = { generateChatReply, DEFAULT_MODEL };
