require("dotenv").config();

// Crash protection
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const express = require("express");

const {
Client,
GatewayIntentBits,
EmbedBuilder
} = require("discord.js");

const fightCommand = require("./commands/fight");
const notifyCommand = require("./commands/notify");

const {
getGame,
setMove,
resetMoves,
deleteGame
} = require("./systems/gameManager");

const { startNotificationScheduler } = require("./systems/notifications");

const { resolveRound } = require("./systems/roundResolver");
const { startRound } = require("./systems/roundUI");
const { animations } = require("./systems/animations");

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

// SLASH COMMAND
if(interaction.isChatInputCommand()){

if(interaction.commandName==="fight"){
await fightCommand.execute(interaction);
}

if(interaction.commandName==="notify"){
await notifyCommand.execute(interaction);
}

}

// BUTTON INTERACTION
if(interaction.isButton()){

const game = getGame(interaction.channelId);
if(!game) return;

const user = interaction.user.id;

// Prevent outsiders
if(user !== game.attacker && user !== game.defender){

return interaction.reply({
content:"You are not part of this fight.",
ephemeral:true
});

}

// Attacker validation
if(user === game.attacker && !["black","white"].includes(interaction.customId)){

return interaction.reply({
content:"You must choose a fist.",
ephemeral:true
});

}

// Defender validation
if(user === game.defender && !["dodge","block"].includes(interaction.customId)){

return interaction.reply({
content:"You must choose dodge or block.",
ephemeral:true
});

}

// Prevent double click
if(game.moves[user]){

return interaction.reply({
content:"You already locked your move.",
ephemeral:true
});

}

// Save move
setMove(
interaction.channelId,
user,
interaction.customId
);

await interaction.reply({
content:`Move **${interaction.customId}** locked`,
ephemeral:true
});

const p1 = game.players[0];
const p2 = game.players[1];

// BOTH MOVES SUBMITTED
if(game.moves[p1] && game.moves[p2]){

const attackerMove = game.moves[game.attacker];
const defenderMove = game.moves[game.defender];

const result = resolveRound(attackerMove,defenderMove);

let winner;

if(result==="attacker"){
winner = game.attacker;
}else{
winner = game.defender;
}

game.score[winner]++;

/* ---------------------------
   ANNOUNCE ATTACK
----------------------------*/

await interaction.channel.send({
embeds:[
new EmbedBuilder()
.setColor("#ff3b3b")
.setTitle("⚔ Attack")
.setDescription(`<@${game.attacker}> used **${attackerMove.toUpperCase()}**`)
]
});

await wait(1500);

/* ---------------------------
   ANNOUNCE DEFENSE
----------------------------*/

await interaction.channel.send({
embeds:[
new EmbedBuilder()
.setColor("#3b82ff")
.setTitle("🛡 Defense")
.setDescription(`<@${game.defender}> used **${defenderMove.toUpperCase()}**`)
]
});

await wait(1500);

/* ---------------------------
   SHOW ONLY WINNING ANIMATION
----------------------------*/

if(result === "attacker"){

await interaction.channel.send({
embeds:[
new EmbedBuilder()
.setColor("#ff4444")
.setTitle("💥 Direct Hit!")
.setDescription(`<@${game.attacker}> lands the hit!`)
.setImage(
animations[
attackerMove === "black" ? "blackPunch" : "whitePunch"
]
)
]
});

}else{

await interaction.channel.send({
embeds:[
new EmbedBuilder()
.setColor("#3b82ff")
.setTitle("🌀 Perfect Defense!")
.setDescription(`<@${game.defender}> successfully defends!`)
.setImage(animations[defenderMove])
]
});

}

await wait(2000);

/* ---------------------------
   SCOREBOARD
----------------------------*/

const resultEmbed = new EmbedBuilder()
.setTitle(`🥊 Round ${game.round} Result`)
.setColor("#2a9d8f")
.addFields(
{
name:"Attacker Move",
value: attackerMove,
inline:true
},
{
name:"Defender Move",
value: defenderMove,
inline:true
},
{
name:"Winner",
value:`<@${winner}>`
},
{
name:"Score",
value:
`<@${p1}> : ${game.score[p1]}\n`+
`<@${p2}> : ${game.score[p2]}`
}
);

await interaction.channel.send({
embeds:[resultEmbed]
});

game.round++;

/* ---------------------------
   MATCH END
----------------------------*/

if(game.round > 5){

let matchWinner;

if(game.score[p1] > game.score[p2]){
matchWinner = p1;
}else{
matchWinner = p2;
}

const victoryEmbed = new EmbedBuilder()
.setColor("#ffd700")
.setTitle("🏆 Final Victory!")
.setDescription(`<@${matchWinner}> wins the match!`)
.setImage(animations.victory);

await interaction.channel.send({ embeds:[victoryEmbed] });

deleteGame(interaction.channelId);

return;

}

resetMoves(interaction.channelId);

await wait(3000);

await startRound(interaction.channel,game);

}

}

});

client.login(process.env.TOKEN);