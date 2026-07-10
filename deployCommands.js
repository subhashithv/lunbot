const { REST, Routes } = require("discord.js");
require("dotenv").config();

const { notifyCommand } = require("./notify");

const commands = [notifyCommand.toJSON()];
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.error("Please set TOKEN and CLIENT_ID in your .env file.");
    process.exit(1);
  }

  const guildId = process.env.GUILD_ID;
  const route = guildId
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  const existingCommands = await rest.get(route);
  for (const command of existingCommands) {
    await rest.delete(`${route}/${command.id}`);
  }

  await rest.put(route, { body: commands });

  console.log(guildId ? `Guild commands deployed for ${guildId}.` : "Global commands deployed.");
})();