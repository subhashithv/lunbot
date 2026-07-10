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

async function addSchedule({ guildId, channelId, userId, message, date, time }) {
  if (!guildId || !channelId || !userId) {
    throw new Error("This command must be used in a server channel.");
  }

  if (!isValidTime(time)) {
    throw new Error("Time must be in HH:MM 24-hour format.");
  }

  const normalizedDate = date || getUtcDateString();
  if (!isValidDate(normalizedDate)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  return saveSchedule({
    guildId,
    channelId,
    userId,
    message,
    date: normalizedDate,
    time,
    targetTimestamp: parseUtcTargetTimestamp(normalizedDate, time)
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
  if (schedule.targetTimestamp) {
    return now.getTime() >= schedule.targetTimestamp;
  }

  const [hours, minutes] = schedule.time.split(":").map(Number);
  return now.getUTCHours() === hours && now.getUTCMinutes() === minutes;
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

      channel
        .send({ content: `<@${schedule.userId}> ${schedule.message}` })
        .catch((error) => console.error("Failed to send scheduled notification:", error));

      await markTriggered(schedule.id);
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
