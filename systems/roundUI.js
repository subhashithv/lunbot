const {
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder
} = require("discord.js");

async function startRound(channel, game){

const embed = new EmbedBuilder()
.setTitle(`🥊 Round ${game.round}`)
.setColor("#e63946")
.setDescription(
`⚔ **Attacker:** <@${game.attacker}>\n`+
`🛡 **Defender:** <@${game.defender}>`
)
.setFooter({ text:"Both players choose your move." });

const buttons = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("black")
.setLabel("Black Fist")
.setEmoji("🥊")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("white")
.setLabel("White Fist")
.setEmoji("⚪")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("dodge")
.setLabel("Dodge")
.setEmoji("🌀")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("block")
.setLabel("Block")
.setEmoji("🛡")
.setStyle(ButtonStyle.Success)

);

await channel.send({
embeds:[embed],
components:[buttons]
});

}

module.exports = { startRound };