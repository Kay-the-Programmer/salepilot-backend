import express from 'express';
import {
    getAccounts, createAccount, updateAccount, deleteAccount,
    getJournalEntries, createManualJournalEntry,
    getSupplierInvoices, createSupplierInvoice, updateSupplierInvoice, recordSupplierPayment
} from '../controllers/accounting.controller';
import {protect, adminOnly, attachTenant} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         number:
 *           type: string
 *         type:
 *           type: string
 *           enum: [asset, liability, equity, revenue, expense]
 *         description:
 *           type: string
 *         balance:
 *           type: number
 */

router.use(protect, adminOnly, attachTenant);

/**
 * @swagger
 * /api/accounting/accounts:
 *   get:
 *     summary: Get all accounts
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 *   post:
 *     summary: Create a new account
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               number:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created successfully
 */
router.route('/accounts')
    .get(getAccounts)
    .post(createAccount);

/**
 * @swagger
 * /api/accounting/accounts/{id}:
 *   put:
 *     summary: Update an account
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Account'
 *     responses:
 *       200:
 *         description: Account updated successfully
 *   delete:
 *     summary: Delete an account
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
router.route('/accounts/:id')
    .put(updateAccount)
    .delete(deleteAccount);

/**
 * @swagger
 * /api/accounting/journal-entries:
 *   get:
 *     summary: Get all journal entries
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal entries
 *   post:
 *     summary: Create a manual journal entry
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               lines:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     accountId:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [debit, credit]
 *                     amount:
 *                       type: number
 *     responses:
 *       201:
 *         description: Journal entry created successfully
 */
router.route('/journal-entries')
    .get(getJournalEntries)
    .post(createManualJournalEntry);

/**
 * @swagger
 * /api/accounting/supplier-invoices:
 *   get:
 *     summary: Get all supplier invoices
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of supplier invoices
 *   post:
 *     summary: Create a supplier invoice
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplierId:
 *                 type: string
 *               amount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Supplier invoice created successfully
 */
router.route('/supplier-invoices')
    .get(getSupplierInvoices)
    .post(createSupplierInvoice);

/**
 * @swagger
 * /api/accounting/supplier-invoices/{id}:
 *   put:
 *     summary: Update a supplier invoice
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Supplier invoice updated successfully
 */
router.route('/supplier-invoices/:id')
    .put(updateSupplierInvoice);

/**
 * @swagger
 * /api/accounting/supplier-invoices/{id}/payments:
 *   post:
 *     summary: Record a payment for a supplier invoice
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 */
router.post('/supplier-invoices/:id/payments', recordSupplierPayment);

export default router;