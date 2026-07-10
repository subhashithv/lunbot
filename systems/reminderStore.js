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
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      targetTimestamp INTEGER NOT NULL,
      triggerSent INTEGER NOT NULL DEFAULT 0
    )
  `);

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
  const existing = await getDbRows(`SELECT id FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  if (existing.length === 0) {
    return false;
  }

  await runDb(`DELETE FROM reminders WHERE id = ? AND guildId = ?`, [id, guildId]);
  return true;
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
