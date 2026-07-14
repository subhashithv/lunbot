const { REST, Routes } = require("discord.js");
require("dotenv").config();

const notifyCommandModule = require("./commands/notify");
const notifyCommand = notifyCommandModule.data || notifyCommandModule.notifyCommand || notifyCommandModule;

const commands = [notifyCommand.toJSON()];
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    console.error("Please set TOKEN and CLIENT_ID in your .env file.");
    process.exit(1);
  }

  const guildId = process.env.GUILD_ID;
  const guildRoute = guildId
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
    : null;
  const globalRoute = Routes.applicationCommands(process.env.CLIENT_ID);

  if (guildRoute) {
    const existingGuildCommands = await rest.get(guildRoute);
    for (const command of existingGuildCommands) {
      await rest.delete(`${guildRoute}/${command.id}`);
    }
    await rest.put(guildRoute, { body: commands });

    const existingGlobalCommands = await rest.get(globalRoute);
    for (const command of existingGlobalCommands.filter((c) => c.name === notifyCommand.name)) {
      await rest.delete(`${globalRoute}/${command.id}`);
    }

    console.log(`Guild commands deployed for ${guildId}.`);
  } else {
    const existingCommands = await rest.get(globalRoute);
    for (const command of existingCommands) {
      await rest.delete(`${globalRoute}/${command.id}`);
    }
    await rest.put(globalRoute, { body: commands });
    console.log("Global commands deployed.");
  }

  console.log(guildId ? `Guild commands deployed for ${guildId}.` : "Global commands deployed.");
})();