import express from 'express';
import db from '../db_client';
import { Return, Sale, Product, StoreSettings } from '../types';
import { generateId } from '../utils/helpers';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';

export const getReturns = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query(`
            SELECT r.*, COALESCE(json_agg(ri.*) FILTER (WHERE ri.id IS NOT NULL), '[]') as "returnedItems"
            FROM returns r
            LEFT JOIN return_items ri ON r.id = ri.return_id
            GROUP BY r.id
            ORDER BY r.timestamp DESC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching returns:', error);
        res.status(500).json({ message: 'Error fetching returns' });
    }
};

export const createReturn = async (req: express.Request, res: express.Response) => {
    // This should be a database transaction
    const returnData: Omit<Return, 'id' | 'timestamp'> = req.body;
    const { originalSaleId, returnedItems, refundAmount, refundMethod } = returnData;
    const id = generateId('ret');
    const timestamp = new Date().toISOString();

    try {
        const saleResult = await db.query('SELECT * FROM sales WHERE transaction_id = $1', [originalSaleId]);
        if (saleResult.rowCount === 0) {
            return res.status(404).json({ message: 'Original sale not found' });
        }
        const originalSale = saleResult.rows[0];

        // 1. Create the return record
        const returnResult = await db.query(
            'INSERT INTO returns (id, original_sale_id, "timestamp", refund_amount, refund_method) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, originalSaleId, timestamp, refundAmount, refundMethod]
        );
        const newReturn = returnResult.rows[0];

        // 2. Process each returned item
        for (const item of returnedItems) {
            await db.query(
                'INSERT INTO return_items (return_id, product_id, product_name, quantity, reason, add_to_stock) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, item.productId, item.productName, item.quantity, item.reason, item.addToStock]
            );
            
            if (item.addToStock) {
                // This is a simplified stock/cost update. A real system might use FIFO/LIFO.
                await db.query(
                    'UPDATE products SET stock = stock + $1 WHERE id = $2',
                    [item.quantity, item.productId]
                );
            }
        }
        
        // 3. Update customer store credit if applicable
        if (refundMethod === 'store_credit') {
            if (!originalSale.customer_id) {
                 return res.status(400).json({ message: 'Cannot refund to store credit: no customer on original sale.' });
            }
            await db.query('UPDATE customers SET store_credit = store_credit + $1 WHERE id = $2', [refundAmount, originalSale.customer_id]);
        }
        
        // 4. Update original sale's refund status
        // This is complex and requires checking all items. For now, we'll just mark as partially refunded.
        // A more robust solution would be a stored procedure or more complex query logic.
        await db.query("UPDATE sales SET refund_status = 'partially_refunded' WHERE transaction_id = $1", [originalSaleId]);

        auditService.log(req.user!, 'Return Processed', `For Sale ID: ${originalSaleId}, Amount: ${refundAmount.toFixed(2)}`);

        res.status(201).json({ ...newReturn, returnedItems });

    } catch (error) {
        console.error('Error creating return:', error);
        res.status(500).json({ message: 'Error processing return' });
    }
};