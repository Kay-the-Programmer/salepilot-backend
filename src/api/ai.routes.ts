import express from 'express';
import {generateDescription} from '../controllers/ai.controller';
import {protect} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/ai/generate-description:
 *   post:
 *     summary: Generate AI product description
 *     description: Generates a compelling product description using AI based on product name and category
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *               - category
 *             properties:
 *               productName:
 *                 type: string
 *                 description: Name of the product
 *                 example: "Wireless Bluetooth Headphones"
 *               category:
 *                 type: string
 *                 description: Category of the product
 *                 example: "Electronics"
 *     responses:
 *       200:
 *         description: Description generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 *                   example: "Immerse yourself in crystal-clear audio with advanced noise-cancellation technology. Experience ultimate comfort during long listening sessions while enjoying up to 30 hours of battery life."
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Product name and category are required."
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to generate AI description. Please try again."
 */
router.post('/generate-description', protect, generateDescription);

export default router;