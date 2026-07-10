const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadReminderStore(dbPath) {
  process.env.REMINDER_DB_PATH = dbPath;
  delete require.cache[require.resolve('../systems/reminderStore')];
  return require('../systems/reminderStore');
}

test('reminder store persists schedules across module reloads', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunbot-reminders-'));
  const dbPath = path.join(tempDir, 'reminders.sqlite');

  const firstStore = loadReminderStore(dbPath);
  const created = await firstStore.addSchedule({
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId: 'user-1',
    message: 'Reminder test',
    date: '2026-07-10',
    time: '18:30',
    targetTimestamp: 1760000000000
  });

  const savedSchedules = await firstStore.listSchedules('guild-1');
  assert.equal(savedSchedules.length, 1);
  assert.equal(savedSchedules[0].message, 'Reminder test');

  const reloadedStore = loadReminderStore(dbPath);
  const reloadedSchedules = await reloadedStore.listSchedules('guild-1');
  assert.equal(reloadedSchedules.length, 1);
  assert.equal(reloadedSchedules[0].id, created.id);

  const removed = await reloadedStore.removeSchedule(created.id, 'guild-1');
  assert.equal(removed, true);
  const afterRemoval = await reloadedStore.listSchedules('guild-1');
  assert.deepEqual(afterRemoval, []);
});
