import { closeDb, getDb } from './client.js';

try {
  const db = await getDb();
  const result = await db.request().query('SELECT DB_NAME() AS databaseName, @@VERSION AS version');
  console.log('MSSQL connection successful:', result.recordset[0]);
} finally {
  await closeDb();
}
