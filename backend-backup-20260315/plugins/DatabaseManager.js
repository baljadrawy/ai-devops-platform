import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Database from 'better-sqlite3';
import ContextModeWrapper from '../utils/ContextModeWrapper.js';

const { Pool } = pg;

/**
 * Database Manager مع Context Mode
 * يلخص الاستعلامات الكبيرة تلقائياً
 */
export class DatabaseManager {
  constructor() {
    this.connections = new Map();
    this.contextMode = new ContextModeWrapper();
    this.name = 'database';
  }

  /**
   * الاتصال بقاعدة بيانات
   */
  async connect({ type, name, config }) {
    try {
      let connection;

      switch (type.toLowerCase()) {
        case 'postgres':
        case 'postgresql':
          connection = await this.connectPostgres(config);
          break;
        case 'mysql':
          connection = await this.connectMySQL(config);
          break;
        case 'mongodb':
        case 'mongo':
          connection = await this.connectMongo(config);
          break;
        case 'sqlite':
          connection = await this.connectSQLite(config);
          break;
        default:
          return { success: false, error: `نوع غير مدعوم: ${type}` };
      }

      this.connections.set(name, { type, connection });

      return {
        success: true,
        message: `تم الاتصال بـ ${type}: ${name}`,
        type
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async connectPostgres(config) {
    const pool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    return pool;
  }

  async connectMySQL(config) {
    const pool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10
    });

    await pool.query('SELECT 1');
    return pool;
  }

  async connectMongo(config) {
    const client = new MongoClient(config.uri || config.url, {
      maxPoolSize: 10
    });

    await client.connect();
    const db = client.db(config.database);
    
    return { client, db };
  }

  async connectSQLite(config) {
    const db = new Database(config.path);
    return db;
  }

  /**
   * تنفيذ استعلام (مع Context Mode للنتائج الكبيرة!)
   */
  async query({ name, sql, values = [], summarize = true }) {
    const conn = this.connections.get(name);
    if (!conn) {
      return { success: false, error: `الاتصال ${name} غير موجود` };
    }

    try {
      let result;

      switch (conn.type) {
        case 'postgres':
          const pgResult = await conn.connection.query(sql, values);
          result = {
            rows: pgResult.rows,
            rowCount: pgResult.rowCount,
            fields: pgResult.fields?.map(f => f.name) || []
          };
          break;

        case 'mysql':
          const [rows, fields] = await conn.connection.query(sql, values);
          result = {
            rows,
            rowCount: rows.length,
            fields: fields.map(f => f.name)
          };
          break;

        case 'sqlite':
          const stmt = conn.connection.prepare(sql);
          const sqliteRows = stmt.all(...values);
          result = {
            rows: sqliteRows,
            rowCount: sqliteRows.length,
            fields: sqliteRows.length > 0 ? Object.keys(sqliteRows[0]) : []
          };
          break;

        default:
          return { success: false, error: 'نوع غير مدعوم' };
      }

      // إذا النتيجة كبيرة (>50 صف)، نلخّص!
      if (summarize && result.rowCount > 50) {
        return {
          success: true,
          summary: {
            count: result.rowCount,
            columns: result.fields,
            sample: result.rows.slice(0, 3), // أول 3 صفوف فقط
            mode: 'context-mode'
          },
          message: `تم تلخيص ${result.rowCount} صف إلى عينة من 3 صفوف`,
          savings: `${((1 - 3/result.rowCount) * 100).toFixed(1)}%`
        };
      }

      // نتيجة صغيرة - نرجعها كاملة
      return {
        success: true,
        data: result,
        mode: 'full'
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * فصل الاتصال
   */
  async disconnect({ name }) {
    const conn = this.connections.get(name);
    if (!conn) {
      return { success: false, error: `الاتصال ${name} غير موجود` };
    }

    try {
      switch (conn.type) {
        case 'postgres':
        case 'mysql':
          await conn.connection.end();
          break;
        case 'mongodb':
          await conn.connection.client.close();
          break;
        case 'sqlite':
          conn.connection.close();
          break;
      }

      this.connections.delete(name);

      return {
        success: true,
        message: `تم فصل الاتصال: ${name}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على قائمة الاتصالات
   */
  getConnections() {
    return Array.from(this.connections.keys()).map(name => ({
      name,
      type: this.connections.get(name).type
    }));
  }
}

export default DatabaseManager;
