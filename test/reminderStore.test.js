const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadReminderStore(dbPath) {
  process.env.REMINDER_DB_PATH = dbPath;
  delete require.cache[require.resolve('../reminderStore')];
  return require('../reminderStore');
}

test('reminder store adds, edits, lists, and removes reminders', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunbot-reminders-'));
  const dbPath = path.join(tempDir, 'reminders.sqlite');

  const store = loadReminderStore(dbPath);
  const created = await store.addReminder({
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId: 'user-1',
    repeat: 'once',
    date: '2026-07-25',
    time: '08:30',
    message: 'Reminder test',
    mention: 'none'
  });

  const listed = await store.listReminders('guild-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].message, 'Reminder test');

  const updated = await store.updateReminder(created.id, {
    message: 'Updated reminder',
    mention: 'here'
  });
  assert.equal(updated.message, 'Updated reminder');
  assert.equal(updated.mention, 'here');

  const removed = await store.removeReminder(created.id, 'guild-1');
  assert.equal(removed, true);
  const afterRemoval = await store.listReminders('guild-1');
  assert.deepEqual(afterRemoval, []);
});
