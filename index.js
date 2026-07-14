require("dotenv").config();

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const { execute } = require("./notify");
const { startScheduler } = require("./scheduler");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();

app.get("/", (_req, res) => res.send("LunBot is running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server listening on ${PORT}`));

const HEARTBEAT_INTERVAL = Number(process.env.HEARTBEAT_INTERVAL) || 20000;
console.log(`Heartbeat interval set to ${HEARTBEAT_INTERVAL}ms`);
setInterval(() => {
  console.log(`Heartbeat: LunBot alive ${new Date().toISOString()}`);
}, HEARTBEAT_INTERVAL);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  startScheduler(client);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "notify") {
    await execute(interaction);
  }
});

client.login(process.env.TOKEN);