const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { addReminder, listReminders, getReminder, updateReminder, removeReminder } = require("./reminderStore");

function weekdayChoices() {
  return [
    { name: "Monday", value: "monday" },
    { name: "Tuesday", value: "tuesday" },
    { name: "Wednesday", value: "wednesday" },
    { name: "Thursday", value: "thursday" },
    { name: "Friday", value: "friday" },
    { name: "Saturday", value: "saturday" },
    { name: "Sunday", value: "sunday" }
  ];
}

function mentionChoices() {
  return [
    { name: "None", value: "none" },
    { name: "Member", value: "member" },
    { name: "Role", value: "role" },
    { name: "Everyone", value: "everyone" },
    { name: "Here", value: "here" }
  ];
}

const notifyCommand = new SlashCommandBuilder()
  .setName("notify")
  .setDescription("Manage reminders")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Create a reminder")
      .addStringOption((option) => option.setName("repeat").setDescription("Repeat interval").setRequired(true).addChoices(
        { name: "Once", value: "once" },
        { name: "Daily", value: "daily" },
        { name: "Weekly", value: "weekly" }
      ))
      .addChannelOption((option) => option.setName("channel").setDescription("Channel to send the reminder in").setRequired(true))
      .addStringOption((option) => option.setName("time").setDescription("Time (HH:MM, 24-hour)").setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("Reminder message").setRequired(true))
      .addStringOption((option) => option.setName("mention").setDescription("How to mention people").addChoices(...mentionChoices()))
      .addUserOption((option) => option.setName("member").setDescription("Member to mention"))
      .addRoleOption((option) => option.setName("role").setDescription("Role to mention"))
      .addStringOption((option) => option.setName("date").setDescription("Date for once reminders (YYYY-MM-DD)"))
      .addStringOption((option) => option.setName("weekday").setDescription("Weekday for weekly reminders").addChoices(...weekdayChoices()))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List your reminders")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("edit")
      .setDescription("Edit a reminder")
      .addStringOption((option) => option.setName("id").setDescription("Reminder ID").setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("New reminder message"))
      .addStringOption((option) => option.setName("time").setDescription("New time (HH:MM)"))
      .addStringOption((option) => option.setName("date").setDescription("New date (YYYY-MM-DD)"))
      .addStringOption((option) => option.setName("weekday").setDescription("New weekday").addChoices(...weekdayChoices()))
      .addStringOption((option) => option.setName("mention").setDescription("New mention mode").addChoices(...mentionChoices()))
      .addUserOption((option) => option.setName("member").setDescription("New member to mention"))
      .addRoleOption((option) => option.setName("role").setDescription("New role to mention"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove a reminder")
      .addStringOption((option) => option.setName("id").setDescription("Reminder ID").setRequired(true))
  );

async function execute(interaction) {
  const allowedUserId = process.env.OWNER_USER_ID || process.env.USER_ID;
  if (allowedUserId && interaction.user.id !== allowedUserId) {
    await interaction.reply({ content: "Only the command creator can use this command.", ephemeral: true });
    return;
  }

  let subcommand;
  try {
    subcommand = interaction.options.getSubcommand();
  } catch {
    subcommand = null;
  }

  if (!subcommand) {
    await interaction.reply({ content: "Please choose a subcommand: add, list, edit, or remove.", ephemeral: true });
    return;
  }

  if (subcommand === "add") {
    const repeat = interaction.options.getString("repeat");
    const channel = interaction.options.getChannel("channel");
    const mention = interaction.options.getString("mention") || "none";
    const member = interaction.options.getUser("member");
    const role = interaction.options.getRole("role");
    const date = interaction.options.getString("date");
    const weekday = interaction.options.getString("weekday");
    const time = interaction.options.getString("time");
    const message = interaction.options.getString("message");

    if (!channel?.isTextBased?.()) {
      await interaction.reply({ content: "Please choose a text channel.", ephemeral: true });
      return;
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      await interaction.reply({ content: "Time must be in HH:MM 24-hour format.", ephemeral: true });
      return;
    }

    if (repeat === "once" && !date) {
      await interaction.reply({ content: "Please provide a date for one-time reminders.", ephemeral: true });
      return;
    }

    if (repeat === "weekly" && !weekday) {
      await interaction.reply({ content: "Please provide a weekday for weekly reminders.", ephemeral: true });
      return;
    }

    const reminder = await addReminder({
      guildId: interaction.guildId,
      channelId: channel.id,
      userId: interaction.user.id,
      repeat,
      date,
      weekday,
      time,
      message,
      mention,
      memberId: member?.id || null,
      roleId: role?.id || null
    });

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("✅ Reminder created")
      .setDescription(`ID: ${reminder.id}`)
      .addFields(
        { name: "Channel", value: `<#${channel.id}>`, inline: true },
        { name: "Repeat", value: repeat, inline: true },
        { name: "Time", value: time, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === "list") {
    const reminders = await listReminders(interaction.guildId);
    const userReminders = reminders.filter((item) => item.userId === interaction.user.id);

    if (!userReminders.length) {
      await interaction.reply({ content: "You do not have any reminders yet.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("📋 Your reminders")
      .setDescription(userReminders.map((item) => `• ${item.id} | ${item.repeat} | ${item.time} | ${item.message}`).join("\n"));

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === "edit") {
    const id = interaction.options.getString("id");
    const reminder = await getReminder(id, interaction.guildId);
    if (!reminder || reminder.userId !== interaction.user.id) {
      await interaction.reply({ content: "Reminder not found.", ephemeral: true });
      return;
    }

    const updates = {};
    const message = interaction.options.getString("message");
    const time = interaction.options.getString("time");
    const date = interaction.options.getString("date");
    const weekday = interaction.options.getString("weekday");
    const mention = interaction.options.getString("mention");
    const member = interaction.options.getUser("member");
    const role = interaction.options.getRole("role");

    if (message !== null) updates.message = message;
    if (time !== null) updates.time = time;
    if (date !== null) updates.date = date;
    if (weekday !== null) updates.weekday = weekday;
    if (mention !== null) updates.mention = mention;
    if (member !== null) updates.memberId = member?.id || null;
    if (role !== null) updates.roleId = role?.id || null;

    const updated = await updateReminder(id, interaction.guildId, updates);
    if (!updated) {
      await interaction.reply({ content: "Reminder could not be updated.", ephemeral: true });
      return;
    }

    await interaction.reply({ content: `Updated reminder ${id}.`, ephemeral: true });
    return;
  }

  if (subcommand === "remove") {
    const id = interaction.options.getString("id");
    const removed = await removeReminder(id, interaction.guildId);
    if (!removed) {
      await interaction.reply({ content: "Reminder not found.", ephemeral: true });
      return;
    }
    await interaction.reply({ content: "Reminder removed.", ephemeral: true });
  }
}

module.exports = { notifyCommand, execute };
