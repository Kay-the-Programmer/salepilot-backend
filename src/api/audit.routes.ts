import express from 'express';
import {getAuditLogs} from '../controllers/audit.controller';
import {protect, adminOnly, attachTenant} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Get audit logs
 *     description: Retrieves audit logs for the current store. Requires admin access.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         schema:
 *           type: string
 *         description: Store ID (can also be provided as x-store-id)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter logs by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter logs by action type (partial match)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs from this date onwards
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs until this date
 *     responses:
 *       200:
 *         description: List of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   storeId:
 *                     type: string
 *                   action:
 *                     type: string
 *                   details:
 *                     type: object
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Unauthorized - not logged in
 *       403:
 *         description: Forbidden - not an admin
 *       500:
 *         description: Server error
 */
router.get('/', protect, adminOnly, attachTenant, getAuditLogs);

export default router;