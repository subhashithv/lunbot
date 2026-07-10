const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "reminders.sqlite");

function ensureDb() {
  const fs = require("fs");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  return new sqlite3.Database(dbPath, (error) => {
    if (error) {
      console.error("Failed to open reminder database:", error);
    }
  });
}

function getDb() {
  return ensureDb();
}

function initializeDb() {
  const db = getDb();

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        channelId TEXT NOT NULL,
        userId TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        targetTimestamp INTEGER NOT NULL,
        triggerSent INTEGER NOT NULL DEFAULT 0
      )
    `);
  });

  return db;
}

function runDb(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = initializeDb();
    db.run(query, params, function (error) {
      db.close();
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function getDbRows(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = initializeDb();
    db.all(query, params, (error, rows) => {
      db.close();
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function addSchedule({ guildId, channelId, userId, message, date, time, targetTimestamp }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await runDb(
    `INSERT INTO reminders (id, guildId, channelId, userId, message, date, time, targetTimestamp, triggerSent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, guildId, channelId, userId, message, date, time, targetTimestamp]
  );

  return { id, guildId, channelId, userId, message, date, time, targetTimestamp, triggerSent: 0 };
}

async function listSchedules(guildId) {
  return getDbRows(`SELECT * FROM reminders WHERE guildId = ?`, [guildId]);
}

async function removeSchedule(id, guildId) {
  const result = await runDb(`DELETE FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  return result.changes > 0;
}

async function markTriggered(id) {
  await runDb(`UPDATE reminders SET triggerSent = 1 WHERE id = ?`, [id]);
}

async function getPendingSchedules() {
  return getDbRows(`SELECT * FROM reminders WHERE triggerSent = 0`);
}

module.exports = {
  addSchedule,
  listSchedules,
  removeSchedule,
  markTriggered,
  getPendingSchedules
};
