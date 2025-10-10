import express from 'express';
import { getDashboardData, getDailySalesWithProducts, getPersonalUseAdjustments } from '../controllers/reports.controller';
import { protect, canManageInventory, canPerformSales } from '../middleware/auth.middleware';

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report generation and analytics endpoints
 *
 * /api/reports/dashboard:
 *   get:
 *     summary: Get dashboard analytics data
 *     description: Retrieves summary data and analytics for the dashboard
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - requires sales access
 *       500:
 *         description: Server error
 *
 * /api/reports/daily-sales:
 *   get:
 *     summary: Get daily sales report
 *     description: Retrieves detailed sales data grouped by day with product breakdowns
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report period
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report period
 *     responses:
 *       200:
 *         description: Daily sales report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 daily:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       totalRevenue:
 *                         type: number
 *                       totalQuantity:
 *                         type: integer
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             quantity:
 *                               type: integer
 *                             revenue:
 *                               type: number
 *       400:
 *         description: Bad request - missing date parameters
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - requires sales access
 *       500:
 *         description: Server error
 *
 * /api/reports/personal-use:
 *   get:
 *     summary: Get personal use inventory adjustments
 *     description: Retrieves a report of inventory adjustments marked as personal use
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report period
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report period
 *     responses:
 *       200:
 *         description: Personal use adjustments report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       userName:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       fromQty:
 *                         type: number
 *                       toQty:
 *                         type: number
 *                       change:
 *                         type: number
 *       400:
 *         description: Bad request - missing date parameters
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - requires inventory management access
 *       500:
 *         description: Server error
 */

router.get('/dashboard', protect, canManageInventory, getDashboardData);
router.get('/daily-sales', protect, canPerformSales, getDailySalesWithProducts);
router.get('/personal-use', protect, canManageInventory, getPersonalUseAdjustments);

export default router;