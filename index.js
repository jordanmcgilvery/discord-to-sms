require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const twilio = require("twilio");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER; // your Twilio number, e.g. +16413815509
const CALL_TO = process.env.CALL_TO; // your Light Phone number, e.g. +14087068540

// How long to wait after the last message before placing the call (ms)
const BATCH_WINDOW_MS = 30 * 1000;
// Safety cap: if messages keep flowing, force a call after this long anyway (ms)
const MAX_WAIT_MS = 2 * 60 * 1000;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("DISCORD_TOKEN");
requireEnv("TWILIO_ACCOUNT_SID");
requireEnv("TWILIO_AUTH_TOKEN");
requireEnv("TWILIO_FROM_NUMBER");
requireEnv("CALL_TO");

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- Batching state ---
let pendingMessages = [];
let debounceTimer = null;
let maxWaitTimer = null;

function queueMessage(entry) {
  pendingMessages.push(entry);

  // Reset the "quiet period" timer every time a new message arrives
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushAndCall, BATCH_WINDOW_MS);

  // Start the hard cap timer only once, when the batch begins
  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(flushAndCall, MAX_WAIT_MS);
  }
}

async function flushAndCall() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (maxWaitTimer) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;

  if (pendingMessages.length === 0) return;

  const batch = pendingMessages;
  pendingMessages = [];

  const count = batch.length;
  const intro =
    count === 1
      ? "You have 1 new Discord message."
      : `You have ${count} new Discord messages.`;

  const lines = batch.map((m, i) => `Message ${i + 1}, in ${m.source}, from ${m.author}: ${m.content}`);
  const spokenText = `${intro} ${lines.join(". ")}`;

  const trimmedSpoken = spokenText.length > 1400 ? spokenText.slice(0, 1397) + "..." : spokenText;
  const twiml = `<Response><Say voice="alice">${escapeXml(trimmedSpoken)}</Say></Response>`;

  try {
    await twilioClient.calls.create({
      twiml,
      from: TWILIO_FROM_NUMBER,
      to: CALL_TO,
    });
    console.log(`Call placed for batch of ${count} message(s).`);
  } catch (err) {
    console.error("Twilio call error:", err?.message || err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} (${client.user.id})`);
  console.log("Guilds:", client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(" | "));
});

client.on("messageCreate", async (msg) => {
  try {
    if (msg.author?.bot) return;

    const content = (msg.content || "").trim();
    if (!content) return;

    const source = msg.guild
      ? `${msg.guild.name}, channel ${msg.channel?.name || "unknown"}`
      : `a direct message`;

    queueMessage({
      source,
      author: msg.author.username,
      content,
    });

    console.log("Queued message:", content);
  } catch (err) {
    console.error("Error queueing message:", err?.message || err);
  }
});

client.login(DISCORD_TOKEN);