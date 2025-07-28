import express from 'express';
import db from '../db_client';
import { PurchaseOrder, ReceptionEvent, SupplierInvoice } from '../types';
import { generateId } from '../utils/helpers';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';

export const getPurchaseOrders = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query(`
            SELECT po.*,
                   COALESCE(json_agg(DISTINCT poi.*) FILTER (WHERE poi.id IS NOT NULL), '[]') as items
            FROM purchase_orders po
            LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
            GROUP BY po.id
            ORDER BY po.created_at DESC
        `);
        // Note: This simplified query doesn't fetch reception history. A more complex query would be needed.
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({ message: 'Error fetching purchase orders' });
    }
};

export const createPurchaseOrder = async (req: express.Request, res: express.Response) => {
    // Should be a transaction
    const { items, ...poData } = req.body;
    const id = generateId('po');
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const createdAt = new Date().toISOString();

    try {
        const poResult = await db.query(
            'INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, status, created_at, ordered_at, expected_at, notes, subtotal, shipping_cost, tax, total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [id, poNumber, poData.supplierId, poData.supplierName, poData.status, createdAt, poData.orderedAt, poData.expectedAt, poData.notes, poData.subtotal, poData.shippingCost, poData.tax, poData.total]
        );
        const newPO = poResult.rows[0];

        for (const item of items) {
            await db.query(
                'INSERT INTO purchase_order_items (po_id, product_id, product_name, sku, quantity, cost_price, received_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [id, item.productId, item.productName, item.sku, item.quantity, item.costPrice, 0]
            );
        }
        
        auditService.log(req.user!, 'Purchase Order Created', `PO Number: ${poNumber}`);
        res.status(201).json({ ...newPO, items });
    } catch (error) {
        console.error('Error creating PO:', error);
        res.status(500).json({ message: 'Error creating purchase order' });
    }
};

export const updatePurchaseOrder = async (req: express.Request, res: express.Response) => {
     // Should be a transaction
    const { id } = req.params;
    const { items, ...poData } = req.body;

    try {
        const oldPOResult = await db.query('SELECT status FROM purchase_orders WHERE id = $1', [id]);
        if (oldPOResult.rowCount === 0) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }
        const oldStatus = oldPOResult.rows[0].status;

        const poResult = await db.query(
            'UPDATE purchase_orders SET supplier_id=$1, supplier_name=$2, status=$3, ordered_at=$4, expected_at=$5, notes=$6, subtotal=$7, shipping_cost=$8, tax=$9, total=$10 WHERE id=$11 RETURNING *',
            [poData.supplierId, poData.supplierName, poData.status, poData.orderedAt, poData.expectedAt, poData.notes, poData.subtotal, poData.shippingCost, poData.tax, poData.total, id]
        );
        const updatedPO = poResult.rows[0];

        await db.query('DELETE FROM purchase_order_items WHERE po_id = $1', [id]);
        for (const item of items) {
             await db.query(
                'INSERT INTO purchase_order_items (po_id, product_id, product_name, sku, quantity, cost_price, received_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [id, item.productId, item.productName, item.sku, item.quantity, item.costPrice, item.receivedQuantity || 0]
            );
        }

        if (oldStatus === 'draft' && updatedPO.status === 'ordered') {
            auditService.log(req.user!, 'Purchase Order Placed', `PO Number: ${updatedPO.po_number}`);
        } else {
            auditService.log(req.user!, 'Purchase Order Updated', `PO Number: ${updatedPO.po_number}`);
        }
        res.status(200).json({ ...updatedPO, items });
    } catch (error) {
        console.error(`Error updating PO ${id}:`, error);
        res.status(500).json({ message: 'Error updating purchase order' });
    }
};

export const deletePurchaseOrder = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const poResult = await db.query("SELECT status, po_number FROM purchase_orders WHERE id = $1", [id]);
        if (poResult.rowCount === 0) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }
        const po = poResult.rows[0];
        if (po.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft purchase orders can be deleted.' });
        }

        // ON DELETE CASCADE will handle deleting items
        await db.query('DELETE FROM purchase_orders WHERE id = $1', [id]);
        auditService.log(req.user!, 'Purchase Order Deleted', `PO Number: ${po.po_number}`);
        res.status(200).json({ message: 'Purchase Order deleted' });
    } catch (error) {
        console.error(`Error deleting PO ${id}:`, error);
        res.status(500).json({ message: 'Error deleting purchase order' });
    }
};

export const receiveItems = async (req: express.Request, res: express.Response) => {
    // Should be a transaction
    const { id } = req.params;
    const receivedItems: { productId: string, quantity: number }[] = req.body;
    
    try {
        for (const item of receivedItems) {
            // Update received quantity on PO
            await db.query('UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE po_id = $2 AND product_id = $3', [item.quantity, id, item.productId]);
            // Update product stock
            await db.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.productId]);
        }
        
        // Update PO status
        const itemsResult = await db.query('SELECT quantity, received_quantity FROM purchase_order_items WHERE po_id = $1', [id]);
        const allReceived = itemsResult.rows.every(item => item.received_quantity >= item.quantity);
        const newStatus = allReceived ? 'received' : 'partially_received';
        const receivedAt = new Date().toISOString();

        const updatedPOResult = await db.query('UPDATE purchase_orders SET status = $1, received_at = $2 WHERE id = $3 RETURNING *', [newStatus, receivedAt, id]);
        
        auditService.log(req.user!, 'PO Stock Received', `PO ID: ${id} | ${receivedItems.length} item types.`);
        res.status(200).json(updatedPOResult.rows[0]);
    } catch (error) {
        console.error(`Error receiving items for PO ${id}:`, error);
        res.status(500).json({ message: 'Error receiving items' });
    }
};