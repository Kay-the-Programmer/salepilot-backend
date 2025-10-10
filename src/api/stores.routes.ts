import express from 'express';
import { registerStore, checkStoreName } from '../controllers/stores.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();



/**
 * @swagger
 * /api/stores/check-name:
 *   get:
 *     summary: Check store name availability
 *     description: Checks if a store name is available for registration
 *     tags: [Stores]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The store name to check
 *     responses:
 *       200:
 *         description: Store name availability check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: Indicates if the store name is available
 *                 message:
 *                   type: string
 *                   description: Optional message (only present for errors)
 *       400:
 *         description: Bad request - name parameter is missing
 *       500:
 *         description: Server error
 */
router.get('/check-name', checkStoreName);

/**
 * @swagger
 * /api/stores/register:
 *   post:
 *     summary: Register a new store
 *     description: Register a new store for the current user and grant admin privileges
 *     tags: [Stores]
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
 *                 description: The name of the store
 *                 minLength: 2
 *     responses:
 *       201:
 *         description: Store successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 store:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request - store name too short or missing
 *       401:
 *         description: Unauthorized - user not authenticated
 *       409:
 *         description: Conflict - store name already exists
 *       500:
 *         description: Server error
 */
router.post('/register', protect, registerStore);

export default router;


