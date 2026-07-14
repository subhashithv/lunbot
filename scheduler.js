const { EmbedBuilder } = require("discord.js");
const { getPendingReminders, markTriggered } = require("./reminderStore");

function getUtcWeekday(date) {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ][date.getUTCDay()];
}

function isDue(reminder, now) {
  if (!reminder?.time || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminder.time)) {
    return false;
  }

  const [hours, minutes] = reminder.time.split(":").map(Number);
  const scheduleUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0);
  const todayUtc = now.toISOString().slice(0, 10);

  if (reminder.repeat === "daily") {
    return now.getTime() >= scheduleUtc && reminder.lastTriggeredDate !== todayUtc;
  }

  if (reminder.repeat === "weekly") {
    const weekday = getUtcWeekday(now);
    return now.getTime() >= scheduleUtc && reminder.weekday === weekday && reminder.lastTriggeredDate !== todayUtc;
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
    try {
      const now = new Date();
      const reminders = await getPendingReminders();

      for (const reminder of reminders) {
        if (!isDue(reminder, now)) continue;

        const channel = (await client.channels.fetch(reminder.channelId).catch(() => null)) || client.channels.cache.get(reminder.channelId);
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
        } catch (error) {
          console.error("Failed to send scheduled reminder:", error);
          continue;
        }
        await markTriggered(reminder.id, reminder.repeat);
      }
    } catch (error) {
      console.error("Scheduler error:", error);
    }
  }, 15000);
}

module.exports = { startScheduler };
