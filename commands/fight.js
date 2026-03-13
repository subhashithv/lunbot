const { createGame, getGame } = require("../systems/gameManager");
const { startRound } = require("../systems/roundUI");
const { EmbedBuilder } = require("discord.js");

module.exports = {

async execute(interaction){

const opponent = interaction.options.getUser("user");

// prevent multiple fights
const existingGame = getGame(interaction.channelId);

if(existingGame){
return interaction.reply({
content:"A fight is already active in this channel.",
ephemeral:true
});
}

createGame(
interaction.channelId,
interaction.user.id,
opponent.id
);

const game = getGame(interaction.channelId);

const embed = new EmbedBuilder()
.setTitle("🥊 Boxing Match Started")
.setColor("#f4a261")
.addFields(
{ name:"Attacker", value:`<@${game.attacker}>`, inline:true },
{ name:"Defender", value:`<@${game.defender}>`, inline:true }
)
.setFooter({ text:"First to win the most rounds wins!" });

await interaction.reply({
embeds:[embed]
});

await startRound(interaction.channel,game);

}

};