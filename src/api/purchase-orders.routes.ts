import express from 'express';
import {
    getPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    receiveItems
} from '../controllers/purchase-orders.controller';
import {protect, canManageInventory} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Purchase Orders
 *   description: Purchase order management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseOrderItem:
 *       type: object
 *       properties:
 *         productId:
 *           type: string
 *         productName:
 *           type: string
 *         sku:
 *           type: string
 *         quantity:
 *           type: number
 *         costPrice:
 *           type: number
 *         receivedQuantity:
 *           type: number
 *     PurchaseOrder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         poNumber:
 *           type: string
 *         supplierId:
 *           type: string
 *         supplierName:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, ordered, partial, received, cancelled]
 *         orderedAt:
 *           type: string
 *           format: date-time
 *         expectedAt:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *         subtotal:
 *           type: number
 *         shippingCost:
 *           type: number
 *         tax:
 *           type: number
 *         total:
 *           type: number
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseOrderItem'
 */

router.use(protect, canManageInventory);

/**
 * @swagger
 * /api/purchase-orders:
 *   get:
 *     summary: Get all purchase orders
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of purchase orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PurchaseOrder'
 *   post:
 *     summary: Create a new purchase order
 *     tags: [Purchase Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseOrder'
 *     responses:
 *       201:
 *         description: Purchase order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchaseOrder'
 */
router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

/**
 * @swagger
 * /api/purchase-orders/{id}:
 *   put:
 *     summary: Update a purchase order
 *     tags: [Purchase Orders]
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
 *             $ref: '#/components/schemas/PurchaseOrder'
 *     responses:
 *       200:
 *         description: Purchase order updated successfully
 *   delete:
 *     summary: Delete a purchase order
 *     tags: [Purchase Orders]
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
 *         description: Purchase order deleted successfully
 */
router.route('/:id')
    .put(updatePurchaseOrder)
    .delete(deletePurchaseOrder);

/**
 * @swagger
 * /api/purchase-orders/{id}/receive:
 *   post:
 *     summary: Receive items for a purchase order
 *     tags: [Purchase Orders]
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
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     receivedQuantity:
 *                       type: number
 *     responses:
 *       200:
 *         description: Items received successfully
 */
router.post('/:id/receive', receiveItems);

export default router;