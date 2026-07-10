const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = process.env.REMINDER_DB_PATH || path.join(__dirname, "data", "reminders.sqlite");

let sqlModule = null;
let sqlModulePromise = null;
let database = null;
let activeDbPath = null;

async function loadSqlModule() {
  if (sqlModule) return sqlModule;
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: (filename) => path.join(__dirname, "node_modules", "sql.js", "dist", filename)
    });
  }
  sqlModule = await sqlModulePromise;
  return sqlModule;
}

function persistDb() {
  if (!database) return;
  const binary = database.export();
  fs.writeFileSync(dbPath, Buffer.from(binary));
}

async function ensureDb() {
  if (database && activeDbPath === dbPath) return database;

  const SQL = await loadSqlModule();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    const fileBuffer = fs.readFileSync(dbPath);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  activeDbPath = dbPath;

  database.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      userId TEXT NOT NULL,
      repeat TEXT NOT NULL DEFAULT 'once',
      date TEXT,
      weekday TEXT,
      time TEXT NOT NULL,
      message TEXT NOT NULL,
      mention TEXT NOT NULL DEFAULT 'none',
      memberId TEXT,
      roleId TEXT,
      targetTimestamp INTEGER,
      lastTriggeredDate TEXT,
      triggerSent INTEGER NOT NULL DEFAULT 0
    )
  `);

  persistDb();
  return database;
}

async function runDb(query, params = []) {
  const db = await ensureDb();
  db.run(query, params);
  persistDb();
  return { changes: db.getRowsModified() };
}

async function getDbRows(query, params = []) {
  const db = await ensureDb();
  const statement = db.prepare(query);
  const rows = [];
  statement.bind(params);
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function normalizeMention(mention) {
  return ["none", "member", "role", "everyone", "here"].includes(mention) ? mention : "none";
}

function normalizeRepeat(repeat) {
  return ["once", "daily", "weekly"].includes(repeat) ? repeat : "once";
}

function parseDateTime(dateString, timeString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes, 0);
}

async function addReminder({ guildId, channelId, userId, repeat, date, weekday, time, message, mention, memberId, roleId }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedRepeat = normalizeRepeat(repeat);
  const normalizedMention = normalizeMention(mention);
  const targetTimestamp = normalizedRepeat === "once" && date ? parseDateTime(date, time) : null;

  await runDb(
    `INSERT INTO reminders (id, guildId, channelId, userId, repeat, date, weekday, time, message, mention, memberId, roleId, targetTimestamp, triggerSent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, guildId, channelId, userId, normalizedRepeat, date || null, weekday || null, time, message, normalizedMention, memberId || null, roleId || null, targetTimestamp]
  );

  return {
    id,
    guildId,
    channelId,
    userId,
    repeat: normalizedRepeat,
    date: date || null,
    weekday: weekday || null,
    time,
    message,
    mention: normalizedMention,
    memberId: memberId || null,
    roleId: roleId || null,
    targetTimestamp,
    triggerSent: 0
  };
}

async function listReminders(guildId) {
  return getDbRows(`SELECT * FROM reminders WHERE guildId = ? ORDER BY time`, [guildId]);
}

async function getReminder(id, guildId) {
  const rows = guildId
    ? await getDbRows(`SELECT * FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId])
    : await getDbRows(`SELECT * FROM reminders WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function updateReminder(id, guildIdOrUpdates, updates) {
  let guildId = null;
  let normalizedUpdates = {};

  if (updates === undefined) {
    normalizedUpdates = guildIdOrUpdates || {};
  } else {
    guildId = guildIdOrUpdates;
    normalizedUpdates = updates || {};
  }

  const existing = await getReminder(id, guildId || normalizedUpdates.guildId);
  if (!existing) return null;

  const fields = [];
  const values = [];

  if (normalizedUpdates.repeat) {
    fields.push("repeat = ?");
    values.push(normalizeRepeat(normalizedUpdates.repeat));
  }
  if (normalizedUpdates.date !== undefined) {
    fields.push("date = ?");
    values.push(normalizedUpdates.date || null);
  }
  if (normalizedUpdates.weekday !== undefined) {
    fields.push("weekday = ?");
    values.push(normalizedUpdates.weekday || null);
  }
  if (normalizedUpdates.time) {
    fields.push("time = ?");
    values.push(normalizedUpdates.time);
  }
  if (normalizedUpdates.message !== undefined) {
    fields.push("message = ?");
    values.push(normalizedUpdates.message);
  }
  if (normalizedUpdates.mention !== undefined) {
    fields.push("mention = ?");
    values.push(normalizeMention(normalizedUpdates.mention));
  }
  if (normalizedUpdates.memberId !== undefined) {
    fields.push("memberId = ?");
    values.push(normalizedUpdates.memberId || null);
  }
  if (normalizedUpdates.roleId !== undefined) {
    fields.push("roleId = ?");
    values.push(normalizedUpdates.roleId || null);
  }
  if (normalizedUpdates.channelId) {
    fields.push("channelId = ?");
    values.push(normalizedUpdates.channelId);
  }
  if (normalizedUpdates.targetTimestamp !== undefined) {
    fields.push("targetTimestamp = ?");
    values.push(normalizedUpdates.targetTimestamp);
  }

  if (!fields.length) return existing;

  values.push(id, existing.guildId);
  await runDb(`UPDATE reminders SET ${fields.join(", ")} WHERE id = ? AND guildId = ?`, values);
  return getReminder(id, existing.guildId);
}

function existingGuildIdForUpdate(updates) {
  return updates.guildId || null;
}

async function removeReminder(id, guildId) {
  const existing = await getReminder(id, guildId);
  if (!existing) return false;
  await runDb(`DELETE FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  return true;
}

async function markTriggered(id, repeat) {
  if (repeat === "daily" || repeat === "weekly") {
    const now = new Date();
    const today = new Date(now.getTime() + now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    await runDb(`UPDATE reminders SET lastTriggeredDate = ? WHERE id = ?`, [today, id]);
    return;
  }

  await runDb(`UPDATE reminders SET triggerSent = 1 WHERE id = ?`, [id]);
}

async function getPendingReminders() {
  return getDbRows(`SELECT * FROM reminders WHERE repeat = 'daily' OR repeat = 'weekly' OR triggerSent = 0`);
}

module.exports = {
  addReminder,
  listReminders,
  getReminder,
  updateReminder,
  removeReminder,
  markTriggered,
  getPendingReminders
};
