const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { addSchedule, listSchedules, removeSchedule } = require("../systems/notifications");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Manage scheduled reminders")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("What to do")
        .setRequired(true)
        .addChoices(
          { name: "Add reminder", value: "add" },
          { name: "List reminders", value: "list" },
          { name: "Remove reminder", value: "remove" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("UTC date for the reminder (YYYY-MM-DD)")
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("UTC time for the reminder (HH:MM, 24-hour)")
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Message to send with the ping")
    )
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("Reminder ID to remove")
    ),

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const date = interaction.options.getString("date");
    const time = interaction.options.getString("time");
    const message = interaction.options.getString("message");
    const id = interaction.options.getString("id");

    if (action === "add") {
      if (!time || !message) {
        await interaction.reply({ content: "Please provide both a time and a message for adding a reminder.", ephemeral: true });
        return;
      }

      try {
        const schedule = addSchedule({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          message,
          date,
          time
        });

        const embed = new EmbedBuilder()
          .setColor("#2ecc71")
          .setTitle("✅ Reminder scheduled")
          .setDescription(`Your reminder is set for UTC ${schedule.date} ${schedule.time} in this channel.`)
          .addFields({ name: "Reminder ID", value: schedule.id });

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return;
    }

    if (action === "list") {
      const schedules = listSchedules(interaction.guildId);
      const userSchedules = schedules.filter((item) => item.userId === interaction.user.id);

      if (!userSchedules.length) {
        await interaction.reply({ content: "You do not have any scheduled reminders yet.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("📋 Your reminders")
        .setDescription(userSchedules.map((item) => `• UTC ${item.date} ${item.time} — ${item.message} (ID: ${item.id})`).join("\n"));

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === "remove") {
      if (!id) {
        await interaction.reply({ content: "Please provide the reminder ID to remove.", ephemeral: true });
        return;
      }

      const removed = removeSchedule(id, interaction.guildId);

      if (!removed) {
        await interaction.reply({ content: "That reminder ID was not found.", ephemeral: true });
        return;
      }

      await interaction.reply({ content: "Reminder removed.", ephemeral: true });
    }
  }
};
