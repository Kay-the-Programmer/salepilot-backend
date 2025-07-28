import express from 'express';
import db from '../db_client';

export const getDashboardData = async (req: express.Request, res: express.Response) => {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate query parameters are required.' });
    }

    try {
        // --- Sales Calculations ---
        const salesQuery = `
            SELECT
                COALESCE(SUM(s.total), 0) AS "totalRevenue",
                COALESCE(SUM(s.total - si.total_cost), 0) AS "totalProfit",
                COALESCE(SUM(si.total_cost), 0) AS "totalCogs",
                COUNT(DISTINCT s.transaction_id) AS "totalTransactions"
            FROM sales s
            JOIN (
                SELECT sale_id, SUM(cost_at_sale * quantity) as total_cost
                FROM sale_items
                GROUP BY sale_id
            ) si ON s.transaction_id = si.sale_id
            WHERE s.timestamp BETWEEN $1 AND $2 AND s.payment_status = 'paid';
        `;
        const salesResult = await db.query(salesQuery, [startDate, endDate]);
        const salesData = salesResult.rows[0];

        // --- Sales Trend ---
        const trendQuery = `
            SELECT
                DATE(s.timestamp) as date,
                SUM(s.total) as revenue,
                SUM(s.total - si.total_cost) as profit
            FROM sales s
            JOIN (
                SELECT sale_id, SUM(cost_at_sale * quantity) as total_cost
                FROM sale_items
                GROUP BY sale_id
            ) si ON s.transaction_id = si.sale_id
            WHERE s.timestamp BETWEEN $1 AND $2 AND s.payment_status = 'paid'
            GROUP BY DATE(s.timestamp)
            ORDER BY date ASC;
        `;
        const trendResult = await db.query(trendQuery, [startDate, endDate]);
        const salesTrend = trendResult.rows.reduce((acc, row) => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            acc[dateStr] = { revenue: parseFloat(row.revenue), profit: parseFloat(row.profit) };
            return acc;
        }, {});
        
        // --- Other Aggregations ---
        // (These would also be converted to SQL for production-grade performance)
        // For now, keeping some logic in JS to simplify the transition.
        
        // --- Inventory Calculations ---
        const invQuery = `
            SELECT
                COALESCE(SUM(price * stock), 0) as "totalRetailValue",
                COALESCE(SUM(cost_price * stock), 0) as "totalCostValue",
                COALESCE(SUM(stock), 0) as "totalUnits"
            FROM products WHERE status = 'active';
        `;
        const invResult = await db.query(invQuery);
        const invData = invResult.rows[0];

        // --- Customer Calculations ---
        const customerQuery = `
            SELECT
                (SELECT COUNT(*) FROM customers) as "totalCustomers",
                COALESCE(SUM(store_credit), 0) as "totalStoreCreditOwed"
        `;
        const customerResult = await db.query(customerQuery);
        const customerData = customerResult.rows[0];

        // --- Final Report Object ---
        const report = {
            sales: {
                totalRevenue: parseFloat(salesData.totalRevenue),
                totalProfit: parseFloat(salesData.totalProfit),
                totalCogs: parseFloat(salesData.totalCogs),
                totalTransactions: parseInt(salesData.totalTransactions, 10),
                avgSaleValue: salesData.totalTransactions > 0 ? salesData.totalRevenue / salesData.totalTransactions : 0,
                grossMargin: salesData.totalRevenue > 0 ? (salesData.totalProfit / salesData.totalRevenue) * 100 : 0,
                salesTrend: salesTrend,
                // Top products/categories would require more complex queries
                topProductsByRevenue: [],
                topProductsByQuantity: [],
                salesByCategory: [],
            },
            inventory: {
                totalRetailValue: parseFloat(invData.totalRetailValue),
                totalCostValue: parseFloat(invData.totalCostValue),
                potentialProfit: invData.totalRetailValue - invData.totalCostValue,
                totalUnits: parseInt(invData.totalUnits, 10),
            },
            customers: {
                totalCustomers: parseInt(customerData.totalCustomers, 10),
                totalStoreCreditOwed: parseFloat(customerData.totalStoreCreditOwed),
                activeCustomersInPeriod: 0, // Requires more complex query
                newCustomersInPeriod: 0, // Requires more complex query
            },
            cashflow: { // Requires querying payments tables
                totalInflow: 0,
                totalOutflow: 0,
                netCashflow: 0,
                cashflowTrend: {},
            }
        };
        
        res.status(200).json(report);
    } catch (error) {
        console.error("Error generating dashboard data:", error);
        res.status(500).json({ message: "Error generating report data" });
    }
};