import express from 'express';
import db from '../db_client';
import { generateId, toCamelCase } from '../utils/helpers';

export const checkStoreName = async (req: express.Request, res: express.Response) => {
  try {
    const name = String((req.query.name || '') as string).trim();
    if (!name) return res.status(400).json({ available: false, message: 'Name is required' });
    const existing = await db.query('SELECT 1 FROM stores WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
    if (existing.rows.length > 0) {
      return res.json({ available: false });
    }
    return res.json({ available: true });
  } catch (e) {
    console.error('Error checking store name:', e);
    return res.status(500).json({ available: false, message: 'Server error' });
  }
};

export const registerStore = async (req: express.Request, res: express.Response) => {
  try {
    const user = req.user!;
    const { name } = req.body || {};

    if (!user || !user.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const trimmed = (name ? String(name) : '').trim();
    if (!trimmed || trimmed.length < 2) {
      return res.status(400).json({ message: 'Store name is required' });
    }

    // Check for existing store name (case-insensitive)
    const existing = await db.query('SELECT id FROM stores WHERE LOWER(name) = LOWER($1) LIMIT 1', [trimmed]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'A store with this name already exists.' });
    }

    const storeId = generateId('store');

    await db.query('BEGIN');
    try {
      // Insert with explicit defaults to accommodate legacy schemas missing column defaults
      await db.query("INSERT INTO stores (id, name, status, subscription_status) VALUES ($1, $2, 'active', 'active')", [storeId, trimmed]);
      // Make the registering user an admin for now (global role) and set current store
      await db.query('UPDATE users SET role = $1, current_store_id = $2 WHERE id = $3', ['admin', storeId, user.id]);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

    // Return the created store and updated user context
    const store = (await db.query('SELECT id, name, created_at FROM stores WHERE id = $1', [storeId])).rows[0];
    return res.status(201).json(toCamelCase({ store }));
  } catch (error) {
    console.error('Error registering store:', error);
    return res.status(500).json({ message: 'Error registering store' });
  }
};
