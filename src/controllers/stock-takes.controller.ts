import express from 'express';
import db from '../db_client';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';

const getActiveSessionWithItems = async () => {
    const sessionRes = await db.query("SELECT * FROM stock_takes WHERE status = 'active' LIMIT 1");
    if (sessionRes.rowCount === 0) return null;
    const session = sessionRes.rows[0];

    const itemsRes = await db.query("SELECT * FROM stock_take_items WHERE stock_take_id = $1 ORDER BY name", [session.id]);
    session.items = itemsRes.rows;
    return session;
}

export const getActiveStockTake = async (req: express.Request, res: express.Response) => {
    try {
        const session = await getActiveSessionWithItems();
        res.status(200).json(session);
    } catch(error) {
        console.error("Error fetching active stock take:", error);
        res.status(500).json({ message: "Error fetching active stock take" });
    }
};

export const startStockTake = async (req: express.Request, res: express.Response) => {
    // Should be a transaction
    try {
        const existing = await db.query("SELECT id FROM stock_takes WHERE status = 'active' LIMIT 1");
        if (existing.rowCount > 0) {
            return res.status(400).json({ message: 'A stock take is already in progress.' });
        }

        const id = `st_${Date.now()}`;
        const startTime = new Date().toISOString();
        await db.query("INSERT INTO stock_takes (id, start_time, status) VALUES ($1, $2, 'active')", [id, startTime]);

        const products = await db.query("SELECT id, name, sku, stock FROM products WHERE status = 'active'");
        for (const p of products.rows) {
            await db.query(
                "INSERT INTO stock_take_items (stock_take_id, product_id, name, sku, expected, counted) VALUES ($1, $2, $3, $4, $5, NULL)",
                [id, p.id, p.name, p.sku, p.stock]
            );
        }

        const newSession = await getActiveSessionWithItems();
        auditService.log(req.user!, 'Stock Take Started', `Session ID: ${id}`);
        res.status(201).json(newSession);
    } catch(error) {
        console.error("Error starting stock take:", error);
        res.status(500).json({ message: "Error starting stock take" });
    }
};

export const updateStockTakeItem = async (req: express.Request, res: express.Response) => {
    try {
        const session = await db.query("SELECT id FROM stock_takes WHERE status = 'active' LIMIT 1");
        if (session.rowCount === 0) {
            return res.status(404).json({ message: 'No active stock take session.' });
        }
        const sessionId = session.rows[0].id;
        const { productId } = req.params;
        const { count } = req.body;

        await db.query("UPDATE stock_take_items SET counted = $1 WHERE stock_take_id = $2 AND product_id = $3", [count, sessionId, productId]);
        
        const updatedSession = await getActiveSessionWithItems();
        res.status(200).json(updatedSession);
    } catch (error) {
        console.error("Error updating stock take item:", error);
        res.status(500).json({ message: "Error updating stock take item" });
    }
};

export const cancelStockTake = async (req: express.Request, res: express.Response) => {
    try {
        const sessionRes = await db.query("SELECT id FROM stock_takes WHERE status = 'active' LIMIT 1");
        if (sessionRes.rowCount === 0) {
            return res.status(404).json({ message: 'No active stock take session to cancel.' });
        }
        const sessionId = sessionRes.rows[0].id;
        // ON DELETE CASCADE will remove items
        await db.query("DELETE FROM stock_takes WHERE id = $1", [sessionId]);
        
        auditService.log(req.user!, 'Stock Take Canceled', `Session ID: ${sessionId}`);
        res.status(200).json({ message: 'Stock take cancelled.' });
    } catch (error) {
        console.error("Error canceling stock take:", error);
        res.status(500).json({ message: "Error canceling stock take" });
    }
};

export const finalizeStockTake = async (req: express.Request, res: express.Response) => {
    // Should be a transaction
    try {
        const session = await getActiveSessionWithItems();
        if (!session) {
            return res.status(404).json({ message: 'No active stock take session to finalize.' });
        }

        for (const item of session.items) {
            if (item.counted !== null && item.counted !== item.expected) {
                await db.query("UPDATE products SET stock = $1 WHERE id = $2", [item.counted, item.productId]);
            }
        }
        
        const endTime = new Date().toISOString();
        await db.query("UPDATE stock_takes SET status = 'completed', end_time = $1 WHERE id = $2", [endTime, session.id]);
        
        auditService.log(req.user!, 'Stock Take Finalized', `Session ID: ${session.id}.`);
        res.status(200).json({ message: 'Stock take finalized and inventory updated.' });
    } catch (error) {
        console.error("Error finalizing stock take:", error);
        res.status(500).json({ message: "Error finalizing stock take" });
    }
};