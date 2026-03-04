require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { Resend } = require("resend");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO = process.env.EMAIL_TO;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("DISCORD_TOKEN");
requireEnv("RESEND_API_KEY");
requireEnv("EMAIL_FROM");
requireEnv("EMAIL_TO");

const resend = new Resend(RESEND_API_KEY);

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
      ? `[${msg.guild.name} #${msg.channel?.name || "unknown"}]`
      : `[DM]`;

    const body = `${source}\n${msg.author.username}: ${content}`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: "Discord Alert",
      text: body,
    });

    console.log("Text sent:", body);
  } catch (err) {
    console.error("Resend error:", err?.message || err);
  }
});

client.login(DISCORD_TOKEN);