import express from 'express';
import { getDashboardData } from '../controllers/reports.controller';
import { protect, canManageInventory } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/dashboard', protect, canManageInventory, getDashboardData);

export default router;