import express from 'express';
import {
    getActiveStockTake,
    startStockTake,
    updateStockTakeItem,
    cancelStockTake,
    finalizeStockTake,
    listCompletedStockTakes,
    getStockTakeDetails
} from '../controllers/stock-takes.controller';
import {protect, canManageInventory} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Stock Takes
 *   description: Stock take management endpoints
 */

/**
 * @swagger
 * /api/stock-takes:
 *   post:
 *     summary: Start a new stock take
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Stock take session created successfully
 *       400:
 *         description: Store context missing or stock take already in progress
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.route('/')
    .post(startStockTake);

/**
 * @swagger
 * /api/stock-takes/active:
 *   get:
 *     summary: Get active stock take session
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active stock take session details
 *       400:
 *         description: Store context missing
 *       404:
 *         description: No active stock take found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Cancel active stock take
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock take cancelled successfully
 *       404:
 *         description: No active stock take to cancel
 *       500:
 *         description: Server error
 */
router.route('/active')
    .get(getActiveStockTake)
    .delete(cancelStockTake);

/**
 * @swagger
 * /api/stock-takes/active/finalize:
 *   post:
 *     summary: Finalize active stock take
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock take finalized successfully
 *       404:
 *         description: No active stock take to finalize
 *       500:
 *         description: Server error
 */
router.post('/active/finalize', finalizeStockTake);

/**
 * @swagger
 * /api/stock-takes/active/items/{productId}:
 *   put:
 *     summary: Update stock count for a product
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               counted:
 *                 type: number
 *     responses:
 *       200:
 *         description: Stock count updated successfully
 *       404:
 *         description: Product not found or no active stock take
 *       500:
 *         description: Server error
 */
router.put('/active/items/:productId', updateStockTakeItem);

/**
 * @swagger
 * /api/stock-takes/completed:
 *   get:
 *     summary: List completed stock takes
 *     tags: [Stock Takes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of completed stock takes
 *       500:
 *         description: Server error
 */
router.get('/completed', listCompletedStockTakes);

/**
 * @swagger
 * /api/stock-takes/{id}:
 *   get:
 *     summary: Get stock take details by ID
 *     tags: [Stock Takes]
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
 *         description: Stock take details
 *       404:
 *         description: Stock take not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getStockTakeDetails);

router.use(protect, canManageInventory);

export default router;