import express from 'express';
import db from '../db_client';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';
import { toCamelCase } from '../utils/helpers';

const getActiveSessionWithItems = async (storeId: string) => {
    const sessionRes = await db.query("SELECT * FROM stock_takes WHERE status = 'active' AND store_id = $1 LIMIT 1", [storeId]);
    if ((sessionRes.rowCount ?? 0) === 0) return null;
    const session = sessionRes.rows[0];

    const itemsRes = await db.query("SELECT * FROM stock_take_items WHERE stock_take_id = $1 AND store_id = $2 ORDER BY name", [session.id, storeId]);
    session.items = itemsRes.rows;
    return session;
}

export const getActiveStockTake = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const session = await getActiveSessionWithItems(storeId);
        res.status(200).json(toCamelCase(session));
    } catch(error) {
        console.error("Error fetching active stock take:", error);
        res.status(500).json({ message: "Error fetching active stock take" });
    }
};

export const startStockTake = async (req: express.Request, res: express.Response) => {
    // Should be a transaction
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const existing = await db.query("SELECT id FROM stock_takes WHERE status = 'active' AND store_id = $1 LIMIT 1", [storeId]);
        if ((existing.rowCount ?? 0) > 0) {
            return res.status(400).json({ message: 'A stock take is already in progress.' });
        }

        const id = `st_${Date.now()}`;
        const startTime = new Date().toISOString();
        await db.query("INSERT INTO stock_takes (id, start_time, status, store_id) VALUES ($1, $2, 'active', $3)", [id, startTime, storeId]);

        const products = await db.query("SELECT id, name, sku, stock FROM products WHERE (status = 'active' OR status IS NULL) AND store_id = $1", [storeId]);
        for (const p of products.rows) {
            await db.query(
                "INSERT INTO stock_take_items (stock_take_id, product_id, name, sku, expected, counted, store_id) VALUES ($1, $2, $3, $4, $5, NULL, $6)",
                [id, p.id, p.name, p.sku ?? '', p.stock, storeId]
            );
        }

        const newSession = await getActiveSessionWithItems(storeId);
        auditService.log(req.user!, 'Stock Take Started', `Session ID: ${id}`);
        res.status(201).json(toCamelCase(newSession));
    } catch(error) {
        console.error("Error starting stock take:", error);
        res.status(500).json({ message: "Error starting stock take" });
    }
};

export const updateStockTakeItem = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const session = await db.query("SELECT id FROM stock_takes WHERE status = 'active' AND store_id = $1 LIMIT 1", [storeId]);
        if ((session.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'No active stock take session.' });
        }
        const sessionId = session.rows[0].id;
        const { productId } = req.params;
        const { count } = req.body;

        await db.query("UPDATE stock_take_items SET counted = $1 WHERE stock_take_id = $2 AND product_id = $3 AND store_id = $4", [count, sessionId, productId, storeId]);

        const updatedSession = await getActiveSessionWithItems(storeId);
        res.status(200).json(toCamelCase(updatedSession));
    } catch (error) {
        console.error("Error updating stock take item:", error);
        res.status(500).json({ message: "Error updating stock take item" });
    }
};

export const cancelStockTake = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const sessionRes = await db.query("SELECT id FROM stock_takes WHERE status = 'active' AND store_id = $1 LIMIT 1", [storeId]);
        if ((sessionRes.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'No active stock take session to cancel.' });
        }
        const sessionId = sessionRes.rows[0].id;
        // ON DELETE CASCADE will remove items
        await db.query("DELETE FROM stock_takes WHERE id = $1 AND store_id = $2", [sessionId, storeId]);

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
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const session = await getActiveSessionWithItems(storeId);
        if (!session) {
            return res.status(404).json({ message: 'No active stock take session to finalize.' });
        }

        // Compute consolidated valuation difference at cost
        let totalAdjustmentCost = 0;
        for (const item of session.items) {
            if (item.counted !== null && item.counted !== item.expected) {
                // Fetch cost price for this product
                const pr = await db.query('SELECT cost_price FROM products WHERE id = $1 AND store_id = $2', [item.productId, storeId]);
                const cost = Number(pr.rows?.[0]?.cost_price) || 0;
                totalAdjustmentCost += (Number(item.counted) - Number(item.expected)) * cost;
                // Update product stock (tenant-scoped)
                await db.query("UPDATE products SET stock = $1 WHERE id = $2 AND store_id = $3", [item.counted, item.productId, storeId]);
            }
        }

        // Post a single consolidated journal entry to adjust Inventory to counted levels
        if (Math.abs(totalAdjustmentCost) > 0.01) {
            await accountingService.recordConsolidatedStockAdjustment(
                totalAdjustmentCost,
                `Stock take adjustment for session ${session.id}`,
                undefined,
                storeId
            );
        }

        const endTime = new Date().toISOString();
        await db.query("UPDATE stock_takes SET status = 'completed', end_time = $1 WHERE id = $2 AND store_id = $3", [endTime, session.id, storeId]);

        auditService.log(req.user!, 'Stock Take Finalized', `Session ID: ${session.id}.`);
        res.status(200).json({ message: 'Stock take finalized and inventory updated.' });
    } catch (error) {
        console.error("Error finalizing stock take:", error);
        res.status(500).json({ message: "Error finalizing stock take" });
    }
};

export const listCompletedStockTakes = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const result = await db.query(
            `SELECT st.id,
                    st.start_time,
                    st.end_time,
                    (
                        SELECT COUNT(*) FROM stock_take_items i
                        WHERE i.stock_take_id = st.id AND i.store_id = $1
                    ) AS total_items,
                    (
                        SELECT COUNT(*) FROM stock_take_items i
                        WHERE i.stock_take_id = st.id AND i.store_id = $1 AND i.counted IS NOT NULL
                    ) AS counted_items,
                    (
                        SELECT COUNT(*) FROM stock_take_items i
                        WHERE i.stock_take_id = st.id AND i.store_id = $1 AND i.counted IS NOT NULL AND i.counted <> i.expected
                    ) AS discrepancy_items
             FROM stock_takes st
             WHERE st.status = 'completed' AND st.store_id = $1
             ORDER BY st.end_time DESC NULLS LAST, st.start_time DESC`,
            [storeId]
        );
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        console.error('Error listing completed stock takes:', error);
        res.status(500).json({ message: 'Error listing completed stock takes' });
    }
};

export const getStockTakeDetails = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const { id } = req.params;
        const sessionRes = await db.query(
            "SELECT id, start_time, end_time, status FROM stock_takes WHERE id = $1 AND store_id = $2",
            [id, storeId]
        );
        if ((sessionRes.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Stock take not found' });
        }
        const itemsRes = await db.query(
            "SELECT product_id, name, sku, expected, counted FROM stock_take_items WHERE stock_take_id = $1 AND store_id = $2 ORDER BY name",
            [id, storeId]
        );
        const session = {
            id: sessionRes.rows[0].id,
            startTime: sessionRes.rows[0].start_time,
            endTime: sessionRes.rows[0].end_time,
            status: sessionRes.rows[0].status,
            items: itemsRes.rows.map(r => ({
                productId: r.product_id,
                name: r.name,
                sku: r.sku,
                expected: r.expected,
                counted: r.counted,
            })),
        };
        res.status(200).json(toCamelCase(session));
    } catch (error) {
        console.error('Error fetching stock take details:', error);
        res.status(500).json({ message: 'Error fetching stock take details' });
    }
};