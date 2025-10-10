import express from 'express';
import {getCategories, createCategory, updateCategory, deleteCategory} from '../controllers/categories.controller';
import {protect, canManageInventory} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     description: Retrieves all categories for the current store. Available to all authenticated users.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   parentId:
 *                     type: string
 *                     nullable: true
 *                   attributes:
 *                     type: array
 *                     items:
 *                       type: object
 *                   revenueAccountId:
 *                     type: string
 *                     nullable: true
 *                   cogsAccountId:
 *                     type: string
 *                     nullable: true
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new category
 *     description: Creates a new category. Requires inventory management access.
 *     tags: [Categories]
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
 *               parentId:
 *                 type: string
 *               attributes:
 *                 type: array
 *                 items:
 *                   type: object
 *               revenueAccountId:
 *                 type: string
 *               cogsAccountId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
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
    .get(protect, getCategories)
    .post(protect, canManageInventory, createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a category
 *     description: Updates an existing category. Requires inventory management access.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
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
 *               parentId:
 *                 type: string
 *               attributes:
 *                 type: array
 *                 items:
 *                   type: object
 *               revenueAccountId:
 *                 type: string
 *               cogsAccountId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid request or store context missing
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a category
 *     description: Deletes a category. Cannot delete categories in use by products or with sub-categories.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category (in use or has sub-categories)
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.route('/:id')
    .put(protect, canManageInventory, updateCategory)
    .delete(protect, canManageInventory, deleteCategory);

export default router;