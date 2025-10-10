import express from 'express';
import {
    getSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplierById
} from '../controllers/suppliers.controller';
import {protect, canManageInventory} from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect, canManageInventory);

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Get all suppliers
 *     description: Retrieves all suppliers for the current store. Requires inventory management access.
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suppliers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new supplier
 *     description: Creates a new supplier for the current store. Requires inventory management access.
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *               bankingDetails:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Invalid request or store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.route('/')
    .get(getSuppliers)
    .post(createSupplier);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     description: Retrieves a specific supplier by ID. Requires inventory management access.
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       404:
 *         description: Supplier not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update supplier
 *     description: Updates an existing supplier. Requires inventory management access.
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *               bankingDetails:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       404:
 *         description: Supplier not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete supplier
 *     description: Deletes a supplier and unlinks associated products. Requires inventory management access.
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Supplier not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.route('/:id')
    .get(getSupplierById)
    .put(updateSupplier)
    .delete(deleteSupplier);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Supplier:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "sup_123"
 *         name:
 *           type: string
 *           example: "ABC Supplies"
 *         contactPerson:
 *           type: string
 *           example: "John Doe"
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         email:
 *           type: string
 *           example: "contact@abcsupplies.com"
 *         address:
 *           type: string
 *           example: "123 Supply St"
 *         paymentTerms:
 *           type: string
 *           example: "Net 30"
 *         bankingDetails:
 *           type: string
 *           example: "Bank: ABC Bank, Account: 123456789"
 *         notes:
 *           type: string
 *           example: "Preferred supplier for electronics"
 *         storeId:
 *           type: string
 *           example: "store_123"
 */