const {
  addSchedule: saveSchedule,
  listSchedules: loadSchedules,
  removeSchedule: deleteSchedule,
  markTriggered,
  getPendingSchedules
} = require("./reminderStore");

function isValidTime(timeString) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeString);
}

function isValidDate(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

function getUtcDateString(date = new Date()) {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function parseUtcTargetTimestamp(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes, 0);
}

async function addSchedule({ guildId, channelId, userId, message, date, time, repeat, mention }) {
  if (!guildId || !channelId || !userId) {
    throw new Error("This command must be used in a server channel.");
  }

  if (!time || !isValidTime(time)) {
    throw new Error("Time must be in HH:MM 24-hour format.");
  }

  const normalizedRepeat = repeat === "daily" ? "daily" : "once";
  let normalizedDate = null;
  let targetTimestamp = null;

  if (normalizedRepeat === "once") {
    normalizedDate = date || getUtcDateString();
    if (!isValidDate(normalizedDate)) {
      throw new Error("Date must be in YYYY-MM-DD format.");
    }
    targetTimestamp = parseUtcTargetTimestamp(normalizedDate, time);
  }

  return saveSchedule({
    guildId,
    channelId,
    userId,
    message,
    date: normalizedDate,
    time,
    targetTimestamp,
    repeat: normalizedRepeat,
    mention: Boolean(mention)
  });
}

async function listSchedules(guildId) {
  const rows = await loadSchedules(guildId);
  return rows.map((row) => ({ ...row, triggerSent: Boolean(row.triggerSent) }));
}

async function removeSchedule(id, guildId) {
  return deleteSchedule(id, guildId);
}

function isDue(schedule, now) {
  const [hours, minutes] = schedule.time.split(":").map(Number);
  const scheduleUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0);
  const today = new Date(now.getTime() + now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  if (schedule.repeat === "daily") {
    if (now.getTime() < scheduleUtc || now.getTime() >= scheduleUtc + 60000) {
      return false;
    }

    if (schedule.lastTriggeredDate === today) {
      return false;
    }

    return true;
  }

  if (!schedule.targetTimestamp) {
    return false;
  }

  return now.getTime() >= schedule.targetTimestamp;
}

function startNotificationScheduler(client) {
  setInterval(async () => {
    const now = new Date();
    const schedules = await getPendingSchedules();

    for (const schedule of schedules) {
      if (!isDue(schedule, now)) {
        continue;
      }

      const channel = client.channels.cache.get(schedule.channelId);
      if (!channel?.isTextBased?.()) {
        continue;
      }

      const content = schedule.mention
        ? `<@${schedule.userId}> ${schedule.message}`
        : schedule.message;
      channel
        .send({
          content,
          allowedMentions: { parse: ["users", "roles"] }
        })
        .catch((error) => console.error("Failed to send scheduled notification:", error));

      await markTriggered(schedule.id, schedule.repeat);
    }
  }, 15000);
}

module.exports = {
  addSchedule,
  listSchedules,
  removeSchedule,
  isValidTime,
  startNotificationScheduler
};
