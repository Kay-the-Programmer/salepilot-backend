import express from 'express';
import {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    archiveProduct,
} from '../controllers/products.controller';
import {protect, canManageInventory} from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieves all products for the current store
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by product name
 *       - in: query
 *         name: sku
 *         schema:
 *           type: string
 *         description: Filter by SKU
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *         description: Filter by supplier ID
 *       - in: query
 *         name: stockStatus
 *         schema:
 *           type: string
 *           enum: [in_stock, out_of_stock, low_stock]
 *         description: Filter by stock status
 *     responses:
 *       200:
 *         description: List of products
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new product
 *     description: Creates a new product. Requires inventory management privileges.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.route('/')
    .get(protect, getProducts)
    .post(protect, canManageInventory, upload.array('images', 5), createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     description: Retrieves a specific product by ID
 *     tags: [Products]
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
 *         description: Product details
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update a product
 *     description: Updates an existing product. Requires inventory management privileges.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       403:
 *         description: Not authorized
 *   delete:
 *     summary: Delete a product
 *     description: Deletes a product. Requires inventory management privileges.
 *     tags: [Products]
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
 *         description: Product deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Product not found
 */
router.route('/:id')
    .get(protect, getProductById)
    .put(protect, canManageInventory, upload.array('images', 5), updateProduct)
    .delete(protect, canManageInventory, deleteProduct);

/**
 * @swagger
 * /api/products/{id}/stock:
 *   patch:
 *     summary: Adjust product stock
 *     description: Adjusts the stock level of a product. Requires inventory management privileges.
 *     tags: [Products]
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
 *               adjustment:
 *                 type: number
 *     responses:
 *       200:
 *         description: Stock adjusted successfully
 *       403:
 *         description: Not authorized
 */
router.patch('/:id/stock', protect, canManageInventory, adjustStock);

/**
 * @swagger
 * /api/products/{id}/archive:
 *   patch:
 *     summary: Archive a product
 *     description: Archives or unarchives a product. Requires inventory management privileges.
 *     tags: [Products]
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
 *         description: Product archived/unarchived successfully
 *       403:
 *         description: Not authorized
 */
router.patch('/:id/archive', protect, canManageInventory, archiveProduct);

export default router;