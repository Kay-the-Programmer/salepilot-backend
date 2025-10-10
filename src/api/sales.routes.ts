import express from 'express';
import {getSales, createSale, recordPayment} from '../controllers/sales.controller';
import {protect, canPerformSales} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales
 *     description: Retrieves all sales records. Requires authentication.
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sales retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   transactionId:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                   total:
 *                     type: number
 *                   subtotal:
 *                     type: number
 *                   tax:
 *                     type: number
 *                   discount:
 *                     type: number
 *                   paymentStatus:
 *                     type: string
 *                     enum: [paid, unpaid, partially_paid]
 *                   amountPaid:
 *                     type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new sale
 *     description: Creates a new sale record. Requires authentication and sales permission.
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cart
 *               - total
 *               - subtotal
 *               - tax
 *             properties:
 *               cart:
 *                 type: array
 *                 items:
 *                   type: object
 *               total:
 *                 type: number
 *               subtotal:
 *                 type: number
 *               tax:
 *                 type: number
 *               discount:
 *                 type: number
 *               customerId:
 *                 type: string
 *               storeCreditUsed:
 *                 type: number
 *     responses:
 *       201:
 *         description: Sale created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to perform sales
 *       500:
 *         description: Server error
 */
router.route('/')
    .get(protect, getSales)
    .post(protect, canPerformSales, createSale);

/**
 * @swagger
 * /api/sales/{id}/payments:
 *   post:
 *     summary: Record a payment for a sale
 *     description: Records a payment for an existing sale. Requires authentication and sales permission.
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sale transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to record payments
 *       404:
 *         description: Sale not found
 *       500:
 *         description: Server error
 */
router.route('/:id/payments')
    .post(protect, canPerformSales, recordPayment);

export default router;