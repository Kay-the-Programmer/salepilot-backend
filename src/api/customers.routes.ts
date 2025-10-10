import express from 'express';
import {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById
} from '../controllers/customers.controller';
import {protect, adminOnly} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     description: Retrieves all customers for the current store. Available to authenticated users.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers retrieved successfully
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
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   address:
 *                     type: string
 *                   notes:
 *                     type: string
 *                   storeCredit:
 *                     type: number
 *                   accountBalance:
 *                     type: number
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new customer
 *     description: Creates a new customer in the current store. Available to authenticated users.
 *     tags: [Customers]
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
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *               storeCredit:
 *                 type: number
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Store context missing or invalid input
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.route('/')
    .get(protect, getCustomers)
    .post(protect, createCustomer);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     description: Retrieves a specific customer by ID. Available to authenticated users.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *       400:
 *         description: Store context missing
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update customer
 *     description: Updates an existing customer. Requires admin access.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *               storeCredit:
 *                 type: number
 *               accountBalance:
 *                 type: number
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       400:
 *         description: Store context missing or invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete customer
 *     description: Deletes a customer. Requires admin access. Cannot delete customers with sales history.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *       400:
 *         description: Store context missing or customer has sales history
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.route('/:id')
    .get(protect, getCustomerById)
    .put(protect, adminOnly, updateCustomer)
    .delete(protect, adminOnly, deleteCustomer);

export default router;