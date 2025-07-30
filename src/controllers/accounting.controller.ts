import express from 'express';
import db from '../db_client';
import { Account, JournalEntry, SupplierInvoice, SupplierPayment } from '../types';
import {generateId, toCamelCase} from '../utils/helpers';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';


// --- Chart of Accounts ---
export const getAccounts = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT * FROM accounts ORDER BY number');
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching accounts' });
    }
};
export const createAccount = async (req: express.Request, res: express.Response) => {
    const { name, number, type, description } = req.body;
    const id = generateId('acc');
    const isDebitNormal = type === 'asset' || type === 'expense';
    try {
        const result = await db.query(
            'INSERT INTO accounts (id, name, number, type, is_debit_normal, description, balance) VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING *',
            [id, name, number, type, isDebitNormal, description]
        );
        auditService.log(req.user!, 'Account Created', `Account: ${name} (${number})`);
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Error creating account' });
    }
};
export const updateAccount = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { name, number, type, description } = req.body;
    try {
        const result = await db.query(
            'UPDATE accounts SET name=$1, number=$2, type=$3, description=$4 WHERE id=$5 RETURNING *',
            [name, number, type, description, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Account not found' });
        auditService.log(req.user!, 'Account Updated', `Account: ${name} (${number})`);
        res.status(200).json(toCamelCase(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Error updating account' });
    }
};
export const deleteAccount = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM accounts WHERE id=$1 RETURNING name, number', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Account not found' });
        auditService.log(req.user!, 'Account Deleted', `Account: ${result.rows[0].name} (${result.rows[0].number})`);
        res.status(200).json({ message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Cannot delete account, it may be in use.' });
    }
};

// --- Journal Entries ---
export const getJournalEntries = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query(`
            SELECT je.*, COALESCE(json_agg(jel.*) FILTER (WHERE jel.id IS NOT NULL), '[]') as lines
            FROM journal_entries je
                     LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
            GROUP BY je.id, je.date
            ORDER BY je.date DESC
        `);
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching journal entries' });
    }
};
export const createManualJournalEntry = async (req: express.Request, res: express.Response) => {
    const entryData: Omit<JournalEntry, 'id'> = req.body;
    const totalDebits = entryData.lines.filter(l => l.type === 'debit').reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = entryData.lines.filter(l => l.type === 'credit').reduce((sum, l) => sum + l.amount, 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return res.status(400).json({ message: 'Debits do not equal credits.' });
    }

    try {
        // This should be a transaction
        const entryId = generateId('je');
        await db.query('INSERT INTO journal_entries (id, date, description, source_type, source_id) VALUES ($1, $2, $3, $4, $5)',
            [entryId, entryData.date, entryData.description, 'manual', null]
        );
        for (const line of entryData.lines) {
            await db.query('INSERT INTO journal_entry_lines (journal_entry_id, account_id, type, amount, account_name) VALUES ($1, $2, $3, $4, $5)',
                [entryId, line.accountId, line.type, line.amount, line.accountName]
            );
        }

        auditService.log(req.user!, 'Manual Journal Entry Created', `Description: ${entryData.description}`);
        res.status(201).json(toCamelCase({ id: entryId, ...entryData }));
    } catch (error) {
        res.status(500).json({ message: 'Error creating manual entry' });
    }
};

// --- Supplier Invoices ---
export const getSupplierInvoices = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query(`
            SELECT si.*, COALESCE(json_agg(sp.*) FILTER (WHERE sp.id IS NOT NULL), '[]') as payments
            FROM supplier_invoices si
                     LEFT JOIN supplier_payments sp ON si.id = sp.supplier_invoice_id
            GROUP BY si.id, si.invoice_date
            ORDER BY si.invoice_date DESC
        `);
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching supplier invoices' });
    }
};
export const createSupplierInvoice = async (req: express.Request, res: express.Response) => {
    const { invoiceNumber, supplierId, supplierName, purchaseOrderId, poNumber, invoiceDate, dueDate, amount } = req.body;
    const id = generateId('inv-sup');
    try {
        const result = await db.query(
            'INSERT INTO supplier_invoices (id, invoice_number, supplier_id, supplier_name, purchase_order_id, po_number, invoice_date, due_date, amount, amount_paid, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, \'unpaid\') RETURNING *',
            [id, invoiceNumber, supplierId, supplierName, purchaseOrderId, poNumber, invoiceDate, dueDate, amount]
        );
        auditService.log(req.user!, 'Supplier Invoice Created', `Invoice #: ${invoiceNumber} for ${supplierName}`);
        res.status(201).json(toCamelCase(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Error creating supplier invoice' });
    }
};
export const updateSupplierInvoice = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { invoiceNumber, supplierId, supplierName, purchaseOrderId, poNumber, invoiceDate, dueDate, amount } = req.body;
    try {
        const result = await db.query(
            'UPDATE supplier_invoices SET invoice_number=$1, supplier_id=$2, supplier_name=$3, purchase_order_id=$4, po_number=$5, invoice_date=$6, due_date=$7, amount=$8 WHERE id=$9 RETURNING *',
            [invoiceNumber, supplierId, supplierName, purchaseOrderId, poNumber, invoiceDate, dueDate, amount, id]
        );
        if(result.rowCount === 0) return res.status(404).json({ message: 'Invoice not found' });
        auditService.log(req.user!, 'Supplier Invoice Updated', `Invoice #: ${invoiceNumber}`);
        res.status(200).json(toCamelCase(result.rows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Error updating supplier invoice' });
    }
};
export const recordSupplierPayment = async (req: express.Request, res: express.Response) => {
    const { id: invoiceId } = req.params;
    const paymentData: Omit<SupplierPayment, 'id'> = req.body;
    try {
        const invoiceRes = await db.query('SELECT amount, amount_paid FROM supplier_invoices WHERE id = $1', [invoiceId]);
        if (invoiceRes.rowCount === 0) return res.status(404).json({ message: 'Invoice not found' });

        const invoice = invoiceRes.rows[0];
        const newAmountPaid = invoice.amount_paid + paymentData.amount;
        const newStatus = newAmountPaid >= invoice.amount ? 'paid' : 'partially_paid';

        await db.query('INSERT INTO supplier_payments (id, supplier_invoice_id, date, amount, method, reference) VALUES ($1, $2, $3, $4, $5, $6)',
            [generateId('spay'), invoiceId, paymentData.date, paymentData.amount, paymentData.method, paymentData.reference]
        );

        const updatedInvoice = await db.query('UPDATE supplier_invoices SET amount_paid = $1, status = $2 WHERE id = $3 RETURNING *',
            [newAmountPaid, newStatus, invoiceId]
        );

        auditService.log(req.user!, 'Supplier Payment Recorded', `For Invoice ID: ${invoiceId}, Amount: ${paymentData.amount.toFixed(2)}`);
        res.status(200).json(toCamelCase(updatedInvoice.rows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Error recording supplier payment' });
    }
};