const fs = require("fs");
const path = require("path");

const notificationsFile = path.join(__dirname, "..", "data", "notifications.json");
const schedules = loadSchedules();

function ensureFile() {
  fs.mkdirSync(path.dirname(notificationsFile), { recursive: true });
  if (!fs.existsSync(notificationsFile)) {
    fs.writeFileSync(notificationsFile, "[]", "utf8");
  }
}

function loadSchedules() {
  ensureFile();

  try {
    const raw = fs.readFileSync(notificationsFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load notifications:", error);
    return [];
  }
}

function saveSchedules() {
  ensureFile();
  fs.writeFileSync(notificationsFile, JSON.stringify(schedules, null, 2), "utf8");
}

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

function addSchedule({ guildId, channelId, userId, message, date, time }) {
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

  const schedule = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    guildId,
    channelId,
    userId,
    message,
    date: normalizedDate,
    time,
    targetTimestamp: parseUtcTargetTimestamp(normalizedDate, time),
    triggerSent: false
  };

  schedules.push(schedule);
  saveSchedules();
  return schedule;
}

function listSchedules(guildId) {
  return schedules.filter((schedule) => schedule.guildId === guildId);
}

function removeSchedule(id, guildId) {
  const index = schedules.findIndex(
    (schedule) => schedule.id === id && schedule.guildId === guildId
  );

  if (index === -1) {
    return false;
  }

  schedules.splice(index, 1);
  saveSchedules();
  return true;
}

function isDue(schedule, now) {
  if (schedule.targetTimestamp) {
    return now.getTime() >= schedule.targetTimestamp;
  }

  const [hours, minutes] = schedule.time.split(":").map(Number);
  return now.getUTCHours() === hours && now.getUTCMinutes() === minutes;
}

function startNotificationScheduler(client) {
  setInterval(() => {
    const now = new Date();

    for (let index = schedules.length - 1; index >= 0; index--) {
      const schedule = schedules[index];

      if (schedule.triggerSent) {
        schedules.splice(index, 1);
        continue;
      }

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

      schedule.triggerSent = true;
      schedules.splice(index, 1);
      saveSchedules();
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
