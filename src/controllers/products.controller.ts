import express from 'express';
import db from '../db_client';
import { Product } from '../types';
import { generateId } from '../utils/helpers';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';


export const getProducts = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

export const getProductById = async (req: express.Request, res: express.Response) => {
    try {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Error fetching product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching product' });
    }
};

export const createProduct = async (req: express.Request, res: express.Response) => {
    const { 
        name, description, sku, barcode, categoryId, price, costPrice, stock, imageUrls,
        supplierId, brand, weight, dimensions, reorderPoint, safetyStock, status, customAttributes 
    } = req.body;

    const id = generateId('prod');

    const queryText = `
        INSERT INTO products(id, name, description, sku, barcode, category_id, supplier_id, price, cost_price, stock, image_urls, brand, status, reorder_point, safety_stock, weight, dimensions, custom_attributes)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *;
    `;
    const values = [
        id, name, description, sku, barcode, categoryId, supplierId, price, costPrice, stock, 
        imageUrls || [], brand, status || 'active', reorderPoint, safetyStock, weight, dimensions, customAttributes || {}
    ];

    try {
        const result = await db.query(queryText, values);
        const createdProduct = result.rows[0];
        await auditService.log(req.user!, 'Product Created', `Product: "${createdProduct.name}" (SKU: ${createdProduct.sku})`);
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Error creating product' });
    }
};

export const updateProduct = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const {
        name, description, sku, barcode, categoryId, supplierId, price, costPrice, stock, imageUrls,
        brand, status, reorderPoint, safetyStock, weight, dimensions, customAttributes
    } = req.body;

    const queryText = `
        UPDATE products
        SET name = $1, description = $2, sku = $3, barcode = $4, category_id = $5, supplier_id = $6, price = $7, 
            cost_price = $8, stock = $9, image_urls = $10, brand = $11, status = $12, reorder_point = $13, 
            safety_stock = $14, weight = $15, dimensions = $16, custom_attributes = $17
        WHERE id = $18
        RETURNING *;
    `;
    const values = [
        name, description, sku, barcode, categoryId, supplierId, price, costPrice, stock, imageUrls,
        brand, status, reorderPoint, safetyStock, weight, dimensions, customAttributes, id
    ];

    try {
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const updatedProduct = result.rows[0];
        await auditService.log(req.user!, 'Product Updated', `Product: "${updatedProduct.name}" (ID: ${updatedProduct.id})`);
        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error(`Error updating product ${id}:`, error);
        res.status(500).json({ message: 'Error updating product' });
    }
};

export const deleteProduct = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const productInfoResult = await db.query('SELECT name, sku FROM products WHERE id = $1', [id]);
        if (productInfoResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const deletedProductInfo = productInfoResult.rows[0];

        await db.query('DELETE FROM products WHERE id = $1', [id]);
        
        await auditService.log(req.user!, 'Product Deleted', `Product: "${deletedProductInfo.name}" (SKU: ${deletedProductInfo.sku})`);
        res.status(200).json({ message: 'Product deleted' });
    } catch (error) {
        console.error(`Error deleting product ${id}:`, error);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

export const archiveProduct = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const productResult = await db.query('SELECT status, name FROM products WHERE id = $1', [id]);
        if (productResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = productResult.rows[0];
        const newStatus = product.status === 'active' ? 'archived' : 'active';
        
        const updateResult = await db.query('UPDATE products SET status = $1 WHERE id = $2 RETURNING *', [newStatus, id]);
        
        const action = newStatus === 'archived' ? 'Product Archived' : 'Product Restored';
        await auditService.log(req.user!, action, `Product: "${product.name}" (ID: ${id})`);
        
        res.status(200).json(updateResult.rows[0]);
    } catch (error) {
        console.error(`Error archiving product ${id}:`, error);
        res.status(500).json({ message: 'Error updating product status' });
    }
};

export const adjustStock = async (req: express.Request, res: express.Response) => {
    const { newQuantity, reason } = req.body;
    const { id } = req.params;

    if (typeof newQuantity !== 'number' || !reason) {
        return res.status(400).json({ message: 'newQuantity (number) and reason (string) are required.' });
    }

    try {
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        if (productResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const product = productResult.rows[0];
        const oldQuantity = product.stock;

        const updateResult = await db.query('UPDATE products SET stock = $1 WHERE id = $2 RETURNING *', [newQuantity, id]);
        
        await auditService.log(req.user!, 'Stock Adjusted', `Product: "${product.name}" | From: ${oldQuantity} To: ${newQuantity} | Reason: ${reason}`);
        
        await accountingService.recordStockAdjustment(product, oldQuantity, reason);
        
        res.status(200).json(updateResult.rows[0]);
    } catch (error) {
        console.error(`Error adjusting stock for product ${id}:`, error);
        res.status(500).json({ message: 'Error adjusting stock' });
    }
};