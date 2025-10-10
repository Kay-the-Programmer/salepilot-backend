import express from 'express';
import {
    listStores,
    updateStore,
    createNotification,
    listNotifications,
    listRevenueSummary,
    listSubscriptionPayments,
    recordSubscriptionPayment
} from '../controllers/superadmin.controller';
import {protect, superAdminOnly} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/superadmin/stores:
 *   get:
 *     summary: List all stores
 *     description: Returns a list of all stores in the system. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stores retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stores:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, suspended]
 *                       subscriptionStatus:
 *                         type: string
 *                         enum: [trial, active, past_due, canceled]
 *                       subscriptionEndsAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 */
router.get('/stores', protect, superAdminOnly, listStores);

/**
 * @swagger
 * /api/superadmin/stores/{id}:
 *   patch:
 *     summary: Update store details
 *     description: Update store status and subscription details. Requires superadmin access.
 *     tags: [Superadmin]
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               subscriptionStatus:
 *                 type: string
 *                 enum: [trial, active, past_due, canceled]
 *               subscriptionEndsAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Store updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       404:
 *         description: Store not found
 *       500:
 *         description: Server error
 */
router.patch('/stores/:id', protect, superAdminOnly, updateStore);

/**
 * @swagger
 * /api/superadmin/notifications:
 *   get:
 *     summary: List system notifications
 *     description: Returns a list of system-wide notifications. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create system notification
 *     description: Create a new system-wide notification. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 */
router.get('/notifications', protect, superAdminOnly, listNotifications);
router.post('/notifications', protect, superAdminOnly, createNotification);

/**
 * @swagger
 * /api/superadmin/revenue/summary:
 *   get:
 *     summary: Get revenue summary
 *     description: Returns summary of subscription revenue. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue summary retrieved successfully
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 */
router.get('/revenue/summary', protect, superAdminOnly, listRevenueSummary);

/**
 * @swagger
 * /api/superadmin/revenue/payments:
 *   get:
 *     summary: List subscription payments
 *     description: Returns a list of all subscription payments. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments retrieved successfully
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 *   post:
 *     summary: Record subscription payment
 *     description: Record a new subscription payment. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Payment recorded successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 */
router.get('/revenue/payments', protect, superAdminOnly, listSubscriptionPayments);

/**
 * @swagger
 * /api/superadmin/revenue/payments:
 *   get:
 *     summary: List subscription payments
 *     description: Returns a list of all subscription payments. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       storeId:
 *                         type: string
 *                       storeName:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       periodStart:
 *                         type: string
 *                         format: date-time
 *                       periodEnd:
 *                         type: string
 *                         format: date-time
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                       method:
 *                         type: string
 *                       reference:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 *   post:
 *     summary: Record subscription payment
 *     description: Record a new subscription payment. Requires superadmin access.
 *     tags: [Superadmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *               - amount
 *               - currency
 *             properties:
 *               storeId:
 *                 type: string
 *                 description: ID of the store making the payment
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 description: Payment currency code
 *               periodStart:
 *                 type: string
 *                 format: date-time
 *                 description: Start date of the subscription period
 *               periodEnd:
 *                 type: string
 *                 format: date-time
 *                 description: End date of the subscription period
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 description: Date when payment was made
 *               method:
 *                 type: string
 *                 description: Payment method used
 *               reference:
 *                 type: string
 *                 description: Payment reference number
 *               notes:
 *                 type: string
 *                 description: Additional notes about the payment
 *     responses:
 *       201:
 *         description: Payment recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     storeId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     method:
 *                       type: string
 *                     reference:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input - Missing required fields
 *       403:
 *         description: Forbidden - Requires superadmin access
 *       500:
 *         description: Server error
 */

router.post('/revenue/payments', protect, superAdminOnly, recordSubscriptionPayment);

export default router;