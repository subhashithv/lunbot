require("dotenv").config();

// Crash protection
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");

const {
Client,
GatewayIntentBits
} = require("discord.js");

const notifyCommand = require("./commands/notify");
const { startNotificationScheduler } = require("./systems/notifications");

const client = new Client({
intents:[GatewayIntentBits.Guilds]
});

function wait(ms){
return new Promise(resolve => setTimeout(resolve, ms));
}

/* ===============================
   Render Web Service Keep Alive
================================ */

const app = express();

app.get("/", (req,res)=>{
res.send("Lunbot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
console.log(`Web server running on port ${PORT}`);
});

function keepAlive() {
  const url = `http://127.0.0.1:${PORT}/`;
  fetch(url)
    .then((res) => console.log(`[KEEPALIVE] pinged ${url} - ${res.status}`))
    .catch((error) => console.error("[KEEPALIVE] failed:", error));
}

keepAlive();
setInterval(keepAlive, 2 * 60 * 1000);

/* ===============================
   Discord Bot
================================ */

client.once("ready",()=>{

console.log(`Logged in as ${client.user.tag}`);
console.log(`Bot connected to ${client.guilds.cache.size} servers`);

startNotificationScheduler(client);

setInterval(()=>{
console.log(`[HEARTBEAT] Bot running at ${new Date().toISOString()}`);
},300000);

});

client.on("interactionCreate",async interaction=>{

if(interaction.isChatInputCommand() && interaction.commandName === "notify"){
await notifyCommand.execute(interaction);
}

});

client.login(process.env.TOKEN);