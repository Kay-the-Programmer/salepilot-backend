import express from 'express';
import {getReturns, createReturn} from '../controllers/returns.controller';
import {protect, canPerformSales} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/returns:
 *   get:
 *     summary: Get all returns
 *     description: Retrieves a list of all returns for the current store. Requires sales permission.
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   originalSaleId:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   returnedItems:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         productId:
 *                           type: string
 *                         productName:
 *                           type: string
 *                         quantity:
 *                           type: number
 *                         reason:
 *                           type: string
 *                         addToStock:
 *                           type: boolean
 *                   refundAmount:
 *                     type: number
 *                   refundMethod:
 *                     type: string
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (sales permission required)
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new return
 *     description: Creates a new return record. Requires sales permission.
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalSaleId
 *               - returnedItems
 *               - refundAmount
 *               - refundMethod
 *             properties:
 *               originalSaleId:
 *                 type: string
 *               returnedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                     - reason
 *                     - addToStock
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     reason:
 *                       type: string
 *                     addToStock:
 *                       type: boolean
 *               refundAmount:
 *                 type: number
 *               refundMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Return created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Return'
 *       400:
 *         description: Invalid request or store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (sales permission required)
 *       500:
 *         description: Server error
 */
router.use(protect, canPerformSales);

router.route('/')
    .get(getReturns)
    .post(createReturn);

export default router;