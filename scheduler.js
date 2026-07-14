const { EmbedBuilder } = require("discord.js");
const { getPendingReminders, markTriggered } = require("./reminderStore");

function getDayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

function isDue(reminder, now) {
  const [hours, minutes] = reminder.time.split(":").map(Number);
  const today = new Date(now.getTime() + now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  if (reminder.repeat === "daily") {
    const scheduleUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0);
    return now.getTime() >= scheduleUtc && now.getTime() < scheduleUtc + 60000 && reminder.lastTriggeredDate !== today;
  }

  if (reminder.repeat === "weekly") {
    const weekday = getDayName(now);
    if (reminder.weekday !== weekday) return false;
    const scheduleUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0);
    return now.getTime() >= scheduleUtc && now.getTime() < scheduleUtc + 60000 && reminder.lastTriggeredDate !== today;
  }

  if (!reminder.targetTimestamp) return false;
  return now.getTime() >= reminder.targetTimestamp;
}

function buildMention(reminder, client) {
  const guild = client.guilds.cache.get(reminder.guildId);
  if (!guild) return reminder.message;

  if (reminder.mention === "member" && reminder.memberId) {
    return `<@${reminder.memberId}> ${reminder.message}`;
  }

  if (reminder.mention === "role" && reminder.roleId) {
    return `<@&${reminder.roleId}> ${reminder.message}`;
  }

  if (reminder.mention === "everyone") return `@everyone ${reminder.message}`;
  if (reminder.mention === "here") return `@here ${reminder.message}`;
  return reminder.message;
}

function startScheduler(client) {
  setInterval(async () => {
    const now = new Date();
    const reminders = await getPendingReminders();

    for (const reminder of reminders) {
      if (!isDue(reminder, now)) continue;

      const channel = client.channels.cache.get(reminder.channelId);
      if (!channel?.isTextBased?.()) continue;

      try {
        const permissions = channel.permissionsFor(client.user.id);
        if (!permissions?.has("SendMessages")) continue;
      } catch {
        continue;
      }

      const content = buildMention(reminder, client);
      try {
        await channel.send({ content, allowedMentions: { parse: ["users", "roles", "everyone"] } });
      } catch {
        continue;
      }
      await markTriggered(reminder.id, reminder.repeat);
    }
  }, 15000);
}

module.exports = { startScheduler };
