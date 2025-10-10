import express from 'express';
import {getSettings, updateSettings} from '../controllers/settings.controller';
import {protect, adminOnly, attachTenant} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get store settings
 *     description: Retrieves settings for the current store. Available to all authenticated users.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         schema:
 *           type: string
 *         description: Store ID (can also be provided as x-store-id)
 *     responses:
 *       200:
 *         description: Store settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "My Store"
 *                 address:
 *                   type: string
 *                   example: "123 Main St"
 *                 phone:
 *                   type: string
 *                   example: "+1234567890"
 *                 email:
 *                   type: string
 *                   example: "store@example.com"
 *                 website:
 *                   type: string
 *                   example: "www.mystore.com"
 *                 taxRate:
 *                   type: number
 *                   example: 10
 *                 currency:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                       example: "$"
 *                     code:
 *                       type: string
 *                       example: "USD"
 *                     position:
 *                       type: string
 *                       enum: [before, after]
 *                 receiptMessage:
 *                   type: string
 *                   example: "Thank you for your purchase!"
 *                 lowStockThreshold:
 *                   type: number
 *                   example: 5
 *                 skuPrefix:
 *                   type: string
 *                   example: "SKU-"
 *                 enableStoreCredit:
 *                   type: boolean
 *                   example: false
 *                 paymentMethods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                 supplierPaymentMethods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update store settings
 *     description: Updates settings for the current store. Requires admin access.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         schema:
 *           type: string
 *         description: Store ID (can also be provided as x-store-id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               taxRate:
 *                 type: number
 *               currency:
 *                 type: object
 *                 properties:
 *                   symbol:
 *                     type: string
 *                   code:
 *                     type: string
 *                   position:
 *                     type: string
 *                     enum: [before, after]
 *               receiptMessage:
 *                 type: string
 *               lowStockThreshold:
 *                 type: number
 *               skuPrefix:
 *                 type: string
 *               enableStoreCredit:
 *                 type: boolean
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *               supplierPaymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreSettings'
 *       400:
 *         description: Invalid request or store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       500:
 *         description: Server error
 */
router.route('/')
    .get(protect, attachTenant, getSettings)
    .put(protect, adminOnly, attachTenant, updateSettings);

export default router;