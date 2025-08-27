import jwt from 'jsonwebtoken';
import db from '../db_client';
import express from 'express';
import { User } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_DEV_ONLY';

export const protect = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
            
            const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            
            req.user = user as User;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const adminOnly = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

export const canManageInventory = (req: express.Request, res: express.Response, next: express.NextFunction) => {
     if (req.user && (req.user.role === 'admin' || req.user.role === 'inventory_manager')) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Inventory management access required' });
    }
};

export const canPerformSales = (req: express.Request, res: express.Response, next: express.NextFunction) => {
     if (req.user && (req.user.role === 'admin' || req.user.role === 'staff')) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Sales access required' });
    }
};