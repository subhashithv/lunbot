const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { addSchedule, listSchedules, removeSchedule } = require("../systems/notifications");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Manage scheduled reminders")
    .setDMPermission(false)
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
        .setName("repeat")
        .setDescription("Choose one-time or daily reminder")
        .addChoices(
          { name: "One-time", value: "once" },
          { name: "Daily", value: "daily" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("UTC date for one-time reminders (YYYY-MM-DD)")
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("UTC time for the reminder (HH:MM, 24-hour)")
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Message to send with the reminder")
    )
    .addBooleanOption((option) =>
      option
        .setName("mention")
        .setDescription("Mention the reminder creator in the notification")
    )
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("Reminder ID to remove")
    ),

  async execute(interaction) {
    const allowedUserId = process.env.OWNER_USER_ID || process.env.USER_ID;

    if (allowedUserId && interaction.user.id !== allowedUserId) {
      await interaction.reply({ content: "Only the command creator can use this command.", ephemeral: true });
      return;
    }

    const action = interaction.options.getString("action");
    const repeat = interaction.options.getString("repeat");
    const date = interaction.options.getString("date");
    const time = interaction.options.getString("time");
    const message = interaction.options.getString("message");
    const mention = interaction.options.getBoolean("mention") || false;
    const id = interaction.options.getString("id");

    if (action === "add") {
      if (!time || !message || !repeat) {
        await interaction.reply({ content: "Please provide a repeat option, time, and message for adding a reminder.", ephemeral: true });
        return;
      }

      if (repeat === "once" && !date) {
        await interaction.reply({ content: "Please provide a date for a one-time reminder.", ephemeral: true });
        return;
      }

      try {
        const schedule = await addSchedule({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          message,
          date,
          time,
          repeat,
          mention
        });

        const embed = new EmbedBuilder()
          .setColor("#2ecc71")
          .setTitle("✅ Reminder scheduled")
          .setDescription(
            repeat === "daily"
              ? `Daily reminder set for UTC ${schedule.time} in this channel.`
              : `One-time reminder set for UTC ${schedule.date} ${schedule.time} in this channel.`
          )
          .addFields(
            { name: "Reminder ID", value: schedule.id, inline: true },
            { name: "Repeat", value: repeat === "daily" ? "Daily" : "One-time", inline: true },
            { name: "Mention Creator", value: mention ? "Yes" : "No", inline: true }
          );

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return;
    }

    if (action === "list") {
      const schedules = await listSchedules(interaction.guildId);
      const userSchedules = schedules.filter((item) => item.userId === interaction.user.id);

      if (!userSchedules.length) {
        await interaction.reply({ content: "You do not have any scheduled reminders yet.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor("#3498db")
        .setTitle("📋 Your reminders")
        .setDescription(
          userSchedules
            .map((item) => {
              const typeLabel = item.repeat === "daily" ? `Daily at ${item.time}` : `Once on ${item.date} ${item.time}`;
              const mentionLabel = item.mention ? "Yes" : "No";
              return `• ${typeLabel} — ${item.message} (Mention creator: ${mentionLabel})\nID: ${item.id}`;
            })
            .join("\n\n")
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === "remove") {
      if (!id) {
        await interaction.reply({ content: "Please provide the reminder ID to remove.", ephemeral: true });
        return;
      }

      const removed = await removeSchedule(id, interaction.guildId);

      if (!removed) {
        await interaction.reply({ content: "That reminder ID was not found.", ephemeral: true });
        return;
      }

      await interaction.reply({ content: "Reminder removed.", ephemeral: true });
    }
  }
};
