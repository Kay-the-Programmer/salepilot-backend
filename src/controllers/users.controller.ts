import express from 'express';
import db from '../db_client';
import { User } from '../types';
import { generateId, toCamelCase } from '../utils/helpers';
import { auditService } from '../services/audit.service';
import bcrypt from 'bcryptjs';

export const getUsers = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT id, name, email, role FROM users ORDER BY name');
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const getUserById = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(toCamelCase(result.rows[0]));
    } catch (error) {
        console.error(`Error fetching user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching user' });
    }
};

export const createUser = async (req: express.Request, res: express.Response) => {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
        return res.status(400).json({ message: 'Name, email, role, and password are required' });
    }

    try {
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExists.rowCount > 0) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const id = generateId('user');

        const result = await db.query(
            'INSERT INTO users (id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [id, name, email.toLowerCase(), role, password_hash]
        );
        const newUser = result.rows[0];

        auditService.log(req.user!, 'User Created', `User: "${name}" (${email})`);
        res.status(201).json(toCamelCase(newUser));
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

export const updateUser = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, email, role } = req.body;

    try {
        if (email) {
            const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), id]);
            if (emailCheck.rowCount > 0) {
                return res.status(400).json({ message: 'Email is already in use by another account' });
            }
        }

        const result = await db.query(
            'UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4 RETURNING id, name, email, role',
            [name, email.toLowerCase(), role, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = result.rows[0];
        auditService.log(req.user!, 'User Updated', `User: "${updatedUser.name}" (${updatedUser.email})`);
        res.status(200).json(toCamelCase(updatedUser));
    } catch (error) {
        console.error(`Error updating user ${id}:`, error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

export const deleteUser = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;

    if (id === req.user?.id) {
        return res.status(400).json({ message: "Cannot delete your own account." });
    }

    try {
        const userResult = await db.query('SELECT role, name, email FROM users WHERE id = $1', [id]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userToDelete = userResult.rows[0];

        if (userToDelete.role === 'admin') {
            const adminCountResult = await db.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
            if (parseInt(adminCountResult.rows[0].count, 10) <= 1) {
                return res.status(400).json({ message: 'Cannot delete the only admin account.' });
            }
        }

        await db.query('DELETE FROM users WHERE id = $1', [id]);
        auditService.log(req.user!, 'User Deleted', `User: "${userToDelete.name}" (${userToDelete.email})`);
        res.status(200).json({ message: 'User deleted' });

    } catch (error) {
        console.error(`Error deleting user ${id}:`, error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};