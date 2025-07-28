import express from 'express';
import db from '../db_client';
import { Category } from '../types';
import { generateId } from '../utils/helpers';
import { auditService } from '../services/audit.service';

export const getCategories = async (req: express.Request, res: express.Response) => {
    try {
        // Assuming 'attributes' is a JSONB column in the categories table
        const result = await db.query('SELECT * FROM categories ORDER BY name');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

export const createCategory = async (req: express.Request, res: express.Response) => {
    const { name, parentId, attributes, revenueAccountId, cogsAccountId } = req.body;
    const id = generateId('cat');

    try {
        const result = await db.query(
            'INSERT INTO categories (id, name, parent_id, attributes, revenue_account_id, cogs_account_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, name, parentId || null, JSON.stringify(attributes || []), revenueAccountId, cogsAccountId]
        );
        const newCategory = result.rows[0];
        auditService.log(req.user!, 'Category Created', `Category: "${newCategory.name}"`);
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

export const updateCategory = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, parentId, attributes, revenueAccountId, cogsAccountId } = req.body;
    try {
        const result = await db.query(
            'UPDATE categories SET name = $1, parent_id = $2, attributes = $3, revenue_account_id = $4, cogs_account_id = $5 WHERE id = $6 RETURNING *',
            [name, parentId || null, JSON.stringify(attributes || []), revenueAccountId, cogsAccountId, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const updatedCategory = result.rows[0];
        auditService.log(req.user!, 'Category Updated', `Category: "${updatedCategory.name}"`);
        res.status(200).json(updatedCategory);
    } catch (error) {
        console.error(`Error updating category ${id}:`, error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

export const deleteCategory = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const productUsage = await db.query('SELECT 1 FROM products WHERE category_id = $1 LIMIT 1', [id]);
        if (productUsage.rowCount > 0) {
            return res.status(400).json({ message: 'Cannot delete category in use by products.' });
        }

        const parentUsage = await db.query('SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1', [id]);
        if (parentUsage.rowCount > 0) {
            return res.status(400).json({ message: 'Cannot delete category with sub-categories.' });
        }

        const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING name', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const deletedCategory = result.rows[0];
        auditService.log(req.user!, 'Category Deleted', `Category: "${deletedCategory.name}"`);
        res.status(200).json({ message: 'Category deleted' });
    } catch (error) {
        console.error(`Error deleting category ${id}:`, error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};