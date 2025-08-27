import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db_client';
import { User } from '../types';
import { generateId, toCamelCase } from '../utils/helpers';
import express from 'express';

const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET!, {
        expiresIn: '30d',
    });
};

export const loginUser = async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        const user = result.rows[0];

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            const userResponse = toCamelCase({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id),
            });
            res.json(userResponse);
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

export const registerUser = async (req: express.Request, res: express.Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    try {
        const userExistsResult = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if ((userExistsResult.rowCount ?? 0) > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const id = generateId('user');
        const role = 'staff'; // Default role

        const insertResult = await db.query(
            'INSERT INTO users(id, name, email, password_hash, role) VALUES($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [id, name, email.toLowerCase(), password_hash, role]
        );
        const newUser = insertResult.rows[0];

        const userResponse = toCamelCase({
            ...newUser,
            token: generateToken(newUser.id),
        });

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

export const getCurrentUser = (req: express.Request, res: express.Response) => {
    res.status(200).json(toCamelCase(req.user));
};

export const forgotPassword = async (req: express.Request, res: express.Response) => {
    const { email } = req.body;
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if ((result.rowCount ?? 0) > 0) {
        // In a real app, you would generate a token and send an email
        console.log(`Password reset link would be sent to ${email}`);
    } else {
        // We don't want to reveal if an email exists or not
        console.log(`Password reset requested for non-existent email: ${email}`);
    }
    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
};

export const changePassword = async (req: express.Request, res: express.Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: 'Invalid input. New password must be at least 8 characters.' });
    }

    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const new_password_hash = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [new_password_hash, userId]);

        res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error changing password' });
    }
};