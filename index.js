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

const {
getGame,
setMove,
resetMoves,
deleteGame
} = require("./systems/gameManager");

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

// Heartbeat log every 5 minutes
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

// Both moves submitted
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

// ATTACK ANIMATION
const attackEmbed = new EmbedBuilder()
.setColor("#ff3b3b")
.setTitle("⚔ Attack")
.setDescription(`<@${game.attacker}> used **${attackerMove.toUpperCase()}**`)
.setImage(
animations[attackerMove === "black" ? "blackPunch" : "whitePunch"]
);

await interaction.channel.send({ embeds:[attackEmbed] });

await wait(2000);

// DEFENSE ANIMATION
const defendEmbed = new EmbedBuilder()
.setColor("#3b82ff")
.setTitle("🛡 Defense")
.setDescription(`<@${game.defender}> used **${defenderMove.toUpperCase()}**`)
.setImage(animations[defenderMove]);

await interaction.channel.send({ embeds:[defendEmbed] });

await wait(2000);

// RESULT ANIMATION
const resultAnim = new EmbedBuilder()
.setColor("#ffb300")
.setTitle(result === "attacker" ? "💥 Direct Hit!" : "🌀 Perfect Defense!")
.setDescription(
result === "attacker"
? `<@${game.attacker}> lands the hit!`
: `<@${game.defender}> successfully defends!`
)
.setImage(result === "attacker" ? animations.attackerWin : animations.defenderWin);

await interaction.channel.send({ embeds:[resultAnim] });

await wait(2000);

// SCOREBOARD
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

// MATCH END
if(game.round > 5){

let matchWinner;

if(game.score[p1] > game.score[p2]){
matchWinner = p1;
}else{
matchWinner = p2;
}

// Victory animation
const victoryEmbed = new EmbedBuilder()
.setColor("#ffd700")
.setTitle("🏆 Final Victory!")
.setDescription(`<@${matchWinner}> wins the match!`)
.setImage(animations.victory);

await interaction.channel.send({ embeds:[victoryEmbed] });

deleteGame(interaction.channelId);

return;

}

// Reset moves
resetMoves(interaction.channelId);

// Wait before next round
await wait(3000);

// Start next round
await startRound(interaction.channel,game);

}

}

});

client.login(process.env.TOKEN);