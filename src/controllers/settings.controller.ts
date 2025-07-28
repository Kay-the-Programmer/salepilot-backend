import express from 'express';
import db from '../db_client';
import { auditService } from '../services/audit.service';
import { StoreSettings } from '../types';

export const getSettings = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT * FROM store_settings WHERE id = 1');
        if (result.rowCount === 0) {
            // Should not happen if DB is seeded, but handle it gracefully
            return res.status(404).json({ message: 'Store settings not found. Please configure them.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ message: "Error fetching settings" });
    }
};

export const updateSettings = async (req: express.Request, res: express.Response) => {
    const newSettings: StoreSettings = req.body;
    try {
        const query = `
            INSERT INTO store_settings (id, name, address, phone, email, website, tax_rate, currency, receipt_message, low_stock_threshold, sku_prefix, enable_store_credit, payment_methods, supplier_payment_methods)
            VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                website = EXCLUDED.website,
                tax_rate = EXCLUDED.tax_rate,
                currency = EXCLUDED.currency,
                receipt_message = EXCLUDED.receipt_message,
                low_stock_threshold = EXCLUDED.low_stock_threshold,
                sku_prefix = EXCLUDED.sku_prefix,
                enable_store_credit = EXCLUDED.enable_store_credit,
                payment_methods = EXCLUDED.payment_methods,
                supplier_payment_methods = EXCLUDED.supplier_payment_methods
            RETURNING *;
        `;
        const values = [
            newSettings.name, newSettings.address, newSettings.phone, newSettings.email, newSettings.website,
            newSettings.taxRate, JSON.stringify(newSettings.currency), newSettings.receiptMessage, newSettings.lowStockThreshold,
            newSettings.skuPrefix, newSettings.enableStoreCredit, JSON.stringify(newSettings.paymentMethods), JSON.stringify(newSettings.supplierPaymentMethods)
        ];

        const result = await db.query(query, values);
        auditService.log(req.user!, 'Settings Updated', 'Store settings were updated.');
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ message: "Error updating settings" });
    }
};