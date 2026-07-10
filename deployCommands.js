const { REST, Routes } = require("discord.js");
require("dotenv").config();

const notifyCommand = require("./commands/notify");

const commands = [
  notifyCommand.data.toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  const guildId = process.env.GUILD_ID;

  if (!guildId) {
    console.error("GUILD_ID is not set. Please set it in your .env file for guild-scoped commands.");
    process.exit(1);
  }

  const route = Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId);
  await rest.put(route, { body: commands });

  console.log(`Guild commands deployed for ${guildId}.`);
})();