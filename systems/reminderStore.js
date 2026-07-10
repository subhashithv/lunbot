const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = process.env.REMINDER_DB_PATH || path.join(__dirname, "..", "data", "reminders.sqlite");

let sqlModule = null;
let sqlModulePromise = null;
let database = null;
let activeDbPath = null;

async function loadSqlModule() {
  if (sqlModule) {
    return sqlModule;
  }

  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: (filename) => path.join(__dirname, "..", "node_modules", "sql.js", "dist", filename)
    });
  }

  sqlModule = await sqlModulePromise;
  return sqlModule;
}

function getExistingColumns(db, tableName) {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result || !result[0]) {
    return [];
  }
  return result[0].values.map((row) => row[1]);
}

async function ensureDb() {
  if (database && activeDbPath === dbPath) {
    return database;
  }

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
      message TEXT NOT NULL,
      date TEXT,
      time TEXT NOT NULL,
      targetTimestamp INTEGER,
      repeat TEXT NOT NULL DEFAULT 'once',
      mention INTEGER NOT NULL DEFAULT 0,
      lastTriggeredDate TEXT,
      triggerSent INTEGER NOT NULL DEFAULT 0
    )
  `);

  const existingColumns = getExistingColumns(database, "reminders");
  if (!existingColumns.includes("repeat")) {
    database.run(`ALTER TABLE reminders ADD COLUMN repeat TEXT NOT NULL DEFAULT 'once'`);
  }
  if (!existingColumns.includes("mention")) {
    database.run(`ALTER TABLE reminders ADD COLUMN mention INTEGER NOT NULL DEFAULT 0`);
  }
  if (!existingColumns.includes("lastTriggeredDate")) {
    database.run(`ALTER TABLE reminders ADD COLUMN lastTriggeredDate TEXT`);
  }

  persistDb();
  return database;
}

function persistDb() {
  if (!database) {
    return;
  }

  const binary = database.export();
  fs.writeFileSync(dbPath, Buffer.from(binary));
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

async function addSchedule({ guildId, channelId, userId, message, date, time, targetTimestamp, repeat, mention }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedRepeat = repeat || "once";
  const normalizedMention = mention ? 1 : 0;
  const normalizedDate = date ?? null;

  await runDb(
    `INSERT INTO reminders (id, guildId, channelId, userId, message, date, time, targetTimestamp, repeat, mention, triggerSent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, guildId, channelId, userId, message, normalizedDate, time, targetTimestamp, normalizedRepeat, normalizedMention]
  );

  return { id, guildId, channelId, userId, message, date: normalizedDate, time, targetTimestamp, repeat: normalizedRepeat, mention: Boolean(normalizedMention), triggerSent: 0 };
}

async function listSchedules(guildId) {
  return getDbRows(`SELECT * FROM reminders WHERE guildId = ?`, [guildId]);
}

async function removeSchedule(id, guildId) {
  const existing = await getDbRows(`SELECT id FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  if (existing.length === 0) {
    return false;
  }

  await runDb(`DELETE FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  return true;
}

async function markTriggered(id, repeat) {
  if (repeat === "daily") {
    const now = new Date();
    const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    await runDb(`UPDATE reminders SET lastTriggeredDate = ? WHERE id = ?`, [utcDate, id]);
    return;
  }

  await runDb(`UPDATE reminders SET triggerSent = 1 WHERE id = ?`, [id]);
}

async function getPendingSchedules() {
  return getDbRows(`SELECT * FROM reminders WHERE repeat = 'daily' OR triggerSent = 0`);
}

module.exports = {
  addSchedule,
  listSchedules,
  removeSchedule,
  markTriggered,
  getPendingSchedules
};
