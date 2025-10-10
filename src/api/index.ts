import express from 'express';
import authRoutes from './auth.routes';
import productRoutes from './products.routes';
import salesRoutes from './sales.routes';
import aiRoutes from './ai.routes';
import customerRoutes from './customers.routes';
import supplierRoutes from './suppliers.routes';
import categoryRoutes from './categories.routes';
import userRoutes from './users.routes';
import returnRoutes from './returns.routes';
import purchaseOrderRoutes from './purchase-orders.routes';
import stockTakeRoutes from './stock-takes.routes';
import accountingRoutes from './accounting.routes';
import settingsRoutes from './settings.routes';
import reportRoutes from './reports.routes';
import auditRoutes from './audit.routes';
import storeRoutes from './stores.routes';
import superadminRoutes from './superadmin.routes';


const router = express.Router();

// --- API Route Definitions ---
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/sales', salesRoutes);
router.use('/ai', aiRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);
router.use('/returns', returnRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/stock-takes', stockTakeRoutes);
router.use('/accounting', accountingRoutes);
router.use('/settings', settingsRoutes);
router.use('/reports', reportRoutes);
router.use('/audit', auditRoutes);
router.use('/stores', storeRoutes);
router.use('/superadmin', superadminRoutes);


/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status and timestamp of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2023-10-09T18:44:00.000Z
 */
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});


export default router;