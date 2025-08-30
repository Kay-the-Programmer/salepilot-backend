import express from 'express';
import db from '../db_client';
import { Product } from '../types';
import { generateId, toCamelCase } from '../utils/helpers';
import { auditService } from '../services/audit.service';
import { accountingService } from '../services/accounting.service';
import path from "path";
import fs from "fs";

// Helper function to handle file uploads and existing images
const processImageUrls = (files: Express.Multer.File[], existingImages: string[] = []): string[] => {
    const uploadedImageUrls = files.map(file => `/uploads/products/${file.filename}`);
    return [...existingImages, ...uploadedImageUrls];
};

// Helper function to process base64 images
const processBase64Images = async (base64Images: string[]): Promise<string[]> => {
    const imageUrls: string[] = [];

    for (let i = 0; i < base64Images.length; i++) {
        const base64Image = base64Images[i];
        if (!base64Image.startsWith('data:image')) continue;

        try {
            // Extract mime type and base64 data
            const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) continue;

            const mimeType = matches[1];
            const base64Data = matches[2];
            const extension = mimeType.split('/')[1] || 'png';

            // Create a buffer from the base64 data
            const buffer = Buffer.from(base64Data, 'base64');

            // Create a unique filename
            const filename = `product-${Date.now()}-${i}.${extension}`;

            // Ensure the uploads directory exists
            const uploadsDir = path.join(__dirname, '../../uploads/products');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Write the file
            const filePath = path.join(uploadsDir, filename);
            fs.writeFileSync(filePath, buffer);

            // Add the URL to the array
            imageUrls.push(`/uploads/products/${filename}`);
        } catch (error) {
            console.error('Error processing base64 image:', error);
        }
    }

    return imageUrls;
};

// Helper function to delete old image files
const deleteImageFiles = (imageUrls: string[]) => {
    imageUrls.forEach(url => {
        if (url.startsWith('/uploads/products/')) {
            const filePath = path.join(__dirname, '../../uploads/products', path.basename(url));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });
};


export const getProducts = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const { name, sku, categoryId, supplierId, stockStatus } = req.query as any;
        const where: string[] = [];
        const params: any[] = [];
        // Enforce tenant boundary first
        params.push(storeId); where.push(`store_id = $${params.length}`);
        if (name) { params.push(`%${name}%`); where.push(`LOWER(name) LIKE LOWER($${params.length})`); }
        if (sku) { params.push(`%${sku}%`); where.push(`LOWER(sku) LIKE LOWER($${params.length})`); }
        if (categoryId) { params.push(categoryId); where.push(`category_id = $${params.length}`); }
        if (supplierId) { params.push(supplierId); where.push(`supplier_id = $${params.length}`); }
        if (stockStatus) {
            const ss = String(stockStatus).toLowerCase();
            if (ss === 'out_of_stock') {
                where.push(`stock <= 0`);
            } else if (ss === 'in_stock') {
                where.push(`stock > 0`);
            } else if (ss === 'low_stock') {
                // low stock compared to reorder_point when set (>0) else compare to default threshold 0
                where.push(`(reorder_point IS NOT NULL AND stock <= reorder_point)`);
            }
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const result = await db.query(`SELECT * FROM products ${whereSql} ORDER BY name ASC`, params);
        res.status(200).json(toCamelCase(result.rows));
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

export const getProductById = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const result = await db.query('SELECT * FROM products WHERE id = $1 AND store_id = $2', [req.params.id, storeId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(toCamelCase(result.rows[0]));
    } catch (error) {
        console.error(`Error fetching product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching product' });
    }
};

export const createProduct = async (req: express.Request, res: express.Response) => {
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        console.log('Creating product with data:', req.body);
        console.log('Files received:', req.files);

        const {
            name, description, sku, barcode, category_id, price, cost_price, stock,
            supplier_id, brand, reorder_point, status, custom_attributes, existing_images,
            unit_of_measure, unitOfMeasure,
            weight, dimensions, safety_stock, safetyStock, variants
        } = req.body;

        const files = req.files as Express.Multer.File[];
        const id = generateId('prod');

        // Input validation
        if (!name || !category_id || !price) {
            return res.status(400).json({
                message: 'Missing required fields: name, category_id, and price are required'
            });
        }

        // Process existing images (should be empty for new products)
        let existingImageUrls: string[] = [];
        if (existing_images) {
            try {
                existingImageUrls = JSON.parse(existing_images);
            } catch (e) {
                console.error('Error parsing existing_images:', e);
                existingImageUrls = [];
            }
        }

        // Separate base64 images from regular URLs
        const base64Images = existingImageUrls.filter(url => url.startsWith('data:image'));
        const regularUrls = existingImageUrls.filter(url => !url.startsWith('data:image'));

        // Process base64 images
        const processedBase64Urls = await processBase64Images(base64Images);

        // Combine all image URLs
        const allImageUrls = processImageUrls(files || [], [...regularUrls, ...processedBase64Urls]);

        // Handle null/undefined values properly with better validation
        const processedValues = {
            name: name?.trim() || '',
            description: description?.trim() || '',
            sku: sku?.trim() || '',
            barcode: barcode?.trim() || null,
            categoryId: category_id?.trim() || null,
            supplierId: supplier_id?.trim() || null,
            price: price && price.toString().trim() ? parseFloat(price.toString()) : 0,
            costPrice: cost_price && cost_price.toString().trim() ? parseFloat(cost_price.toString()) : null,
            stock: stock && stock.toString().trim() ? parseFloat(stock.toString()) : 0,
            imageUrls: allImageUrls,
            brand: brand?.trim() || '',
            status: status || 'active',
            reorderPoint: reorder_point && reorder_point.toString().trim() ? parseInt(reorder_point.toString(), 10) : null,
            customAttributes: custom_attributes ?
                (typeof custom_attributes === 'string' ? JSON.parse(custom_attributes) : custom_attributes) : {},
            unitOfMeasure: (unit_of_measure || unitOfMeasure || 'unit').toString().toLowerCase() === 'kg' ? 'kg' : 'unit',
            weight: weight && weight.toString().trim() ? parseFloat(weight.toString()) : null,
            dimensions: dimensions?.toString().trim() || null,
            safetyStock: (safety_stock ?? safetyStock) && (safety_stock ?? safetyStock).toString().trim() ? parseInt((safety_stock ?? safetyStock).toString(), 10) : null,
            variants: (() => {
                if (!variants) return [];
                try {
                    const v = typeof variants === 'string' ? JSON.parse(variants) : variants;
                    return Array.isArray(v) ? v : [];
                } catch {
                    return [];
                }
            })()
        };

        // Additional validation
        if (processedValues.price <= 0) {
            return res.status(400).json({ message: 'Price must be greater than 0' });
        }

        if (processedValues.stock < 0) {
            return res.status(400).json({ message: 'Stock cannot be negative' });
        }

        const queryText = `
            INSERT INTO products(id, name, description, sku, barcode, category_id, supplier_id, price, cost_price, stock, unit_of_measure, image_urls, brand, status, reorder_point, weight, dimensions, safety_stock, variants, custom_attributes, store_id)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *;
        `;
        const values = [
            id,
            processedValues.name,
            processedValues.description,
            processedValues.sku,
            processedValues.barcode,
            processedValues.categoryId,
            processedValues.supplierId,
            processedValues.price,
            processedValues.costPrice,
            processedValues.stock,
            processedValues.unitOfMeasure,
            processedValues.imageUrls,
            processedValues.brand,
            processedValues.status,
            processedValues.reorderPoint,
            processedValues.weight,
            processedValues.dimensions,
            processedValues.safetyStock,
            JSON.stringify(processedValues.variants || []),
            JSON.stringify(processedValues.customAttributes),
            storeId
        ];

        console.log('Executing query with values:', values);

        const result = await db.query(queryText, values);
        const createdProduct = result.rows[0];
        await auditService.log(req.user!, 'Product Created', `Product: "${createdProduct.name}" (SKU: ${createdProduct.sku})`);
        res.status(201).json(toCamelCase(createdProduct));
    } catch (error) {
        // If database operation fails, clean up uploaded files
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
            deleteImageFiles(files.map(file => `/uploads/products/${file.filename}`));
        }

        // Handle known DB errors more gracefully
        const pgErr = error as any;
        if (pgErr && pgErr.code === '23505') { // unique_violation
            const constraint: string = pgErr.constraint || '';
            if (constraint.includes('sku')) {
                return res.status(409).json({ message: 'A product with this SKU already exists. Please use a unique SKU.' });
            }
            if (constraint.includes('barcode')) {
                return res.status(409).json({ message: 'A product with this barcode already exists.' });
            }
            return res.status(409).json({ message: 'Duplicate value violates a unique constraint.' });
        }

        console.error('Error creating product:', error);
        console.error('Error details:', {
            message: (error as Error).message,
            stack: (error as Error).stack,
            requestBody: req.body
        });
        res.status(500).json({
            message: 'Error creating product',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
        });
    }
};

export const updateProduct = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;

    console.log('Request body:', req.body);
    console.log('Files:', req.files);

    // Handle both snake_case (from FormData) and camelCase (from JSON)
    const body = req.body;
    const name = body.name;
    const description = body.description;
    const sku = body.sku;
    const barcode = body.barcode;
    const category_id = body.category_id || body.categoryId;
    const supplier_id = body.supplier_id || body.supplierId;
    const price = body.price;
    const cost_price = body.cost_price || body.costPrice;
    const stock = body.stock;
    const brand = body.brand;
    const status = body.status;
    const reorder_point = body.reorder_point || body.reorderPoint;
    const custom_attributes = body.custom_attributes || body.customAttributes;
    const unit_of_measure = body.unit_of_measure || body.unitOfMeasure;
    const weight = body.weight;
    const dimensions = body.dimensions;
    const safety_stock = body.safety_stock || body.safetyStock;
    const variants = body.variants;
    const existing_images = body.existing_images;
    const images_to_delete = body.images_to_delete;

    const files = (req.files as Express.Multer.File[]) || [];

    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const currentProductResult = await db.query('SELECT image_urls FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);
        if (currentProductResult.rowCount === 0) {
            if (files.length > 0) {
                deleteImageFiles(files.map(file => `/uploads/products/${file.filename}`));
            }
            return res.status(404).json({ message: 'Product not found' });
        }

        const dbImageUrls = currentProductResult.rows[0].image_urls;
        let currentImageUrls: string[] = [];
        if (Array.isArray(dbImageUrls)) {
            currentImageUrls = dbImageUrls;
        } else if (typeof dbImageUrls === 'string') {
            try {
                currentImageUrls = JSON.parse(dbImageUrls);
            } catch (e) {
                console.error('Error parsing image_urls from DB, treating as empty:', e);
            }
        }

        let finalImageUrls: string[] = body.imageUrls || currentImageUrls;

        // This logic is for multipart/form-data requests which is the primary way to update products with images
        if (files.length > 0 || images_to_delete || existing_images) {
            let existingImageUrls: string[] = [];
            if (existing_images) {
                try {
                    existingImageUrls = typeof existing_images === 'string' ? JSON.parse(existing_images) : existing_images;
                } catch (e) { console.error('Error parsing existing_images:', e); existingImageUrls = currentImageUrls; }
            } else {
                existingImageUrls = currentImageUrls;
            }

            let imagesToDeleteArr: string[] = [];
            if (images_to_delete) {
                try {
                    imagesToDeleteArr = typeof images_to_delete === 'string' ? JSON.parse(images_to_delete) : images_to_delete;
                    existingImageUrls = existingImageUrls.filter(url => !imagesToDeleteArr.includes(url));
                    deleteImageFiles(imagesToDeleteArr);
                } catch (e) { console.error('Error parsing images_to_delete:', e); }
            }

            const base64Images = existingImageUrls.filter(url => url.startsWith('data:image'));
            const regularUrls = existingImageUrls.filter(url => !url.startsWith('data:image'));
            const processedBase64Urls = await processBase64Images(base64Images);
            finalImageUrls = processImageUrls(files, [...regularUrls, ...processedBase64Urls]);
        }

        let customAttributesObj = {};
        if (custom_attributes) {
            try {
                customAttributesObj = typeof custom_attributes === 'string' ? JSON.parse(custom_attributes) : custom_attributes;
            } catch (e) { console.error('Error parsing custom_attributes:', e); }
        }

        const queryText = `
            UPDATE products
            SET name = $1, description = $2, sku = $3, barcode = $4, category_id = $5, supplier_id = $6, price = $7,
                cost_price = $8, stock = $9, unit_of_measure = $10, image_urls = $11, brand = $12, status = $13, reorder_point = $14,
                custom_attributes = $15, weight = $16, dimensions = $17, safety_stock = $18, variants = $19
            WHERE id = $20 AND store_id = $21
            RETURNING *;
        `;

        const values = [
            name || null,
            description || null,
            sku || null,
            barcode || null,
            category_id || null,
            supplier_id || null,
            price != null ? parseFloat(price.toString()) : null,
            cost_price != null ? parseFloat(cost_price.toString()) : null,
            stock != null ? parseFloat(stock.toString()) : null,
            (unit_of_measure || 'unit').toString().toLowerCase() === 'kg' ? 'kg' : 'unit',
            finalImageUrls,
            brand || null,
            status || 'active',
            reorder_point != null ? parseInt(reorder_point.toString(), 10) : null,
            JSON.stringify(customAttributesObj),
            weight != null && weight !== '' ? parseFloat(weight.toString()) : null,
            dimensions || null,
            safety_stock != null && safety_stock !== '' ? parseInt(safety_stock.toString(), 10) : null,
            (() => { try { return JSON.stringify(typeof variants === 'string' ? JSON.parse(variants) : (variants || [])); } catch { return JSON.stringify([]); } })(),
            id,
            storeId
        ];

        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = result.rows[0];
        await auditService.log(req.user!, 'Product Updated', `Product: "${updatedProduct.name}" (ID: ${updatedProduct.id})`);
        res.status(200).json(toCamelCase(updatedProduct));

    } catch (error) {
        if (files.length > 0) {
            deleteImageFiles(files.map(file => `/uploads/products/${file.filename}`));
        }
        const pgErr = error as any;
        if (pgErr && pgErr.code === '23505') { // unique_violation
            const constraint: string = pgErr.constraint || '';
            if (constraint.includes('sku')) {
                return res.status(409).json({ message: 'A product with this SKU already exists. Please use a unique SKU.' });
            }
            if (constraint.includes('barcode')) {
                return res.status(409).json({ message: 'A product with this barcode already exists.' });
            }
            return res.status(409).json({ message: 'Duplicate value violates a unique constraint.' });
        }
        console.error(`Error updating product ${id}:`, error);
        res.status(500).json({ message: 'Error updating product', error: (error as Error).message });
    }
};
// ... rest of your existing controller functions
// export const updateProduct = async (req: express.Request, res: express.Response) => {
//     const { id } = req.params;
//     const {
//         name, description, sku, barcode, categoryId, supplierId, price, costPrice, stock, imageUrls,
//         brand, status, reorderPoint, customAttributes
//     } = req.body;
//
//     const queryText = `
//         UPDATE products
//         SET name = $1, description = $2, sku = $3, barcode = $4, category_id = $5, supplier_id = $6, price = $7,
//             cost_price = $8, stock = $9, image_urls = $10, brand = $11, status = $12, reorder_point = $13,
//             custom_attributes = $14
//         WHERE id = $15
//         RETURNING *;
//     `;
//     const values = [
//         name, description, sku, barcode, categoryId, supplierId, price, costPrice, stock, imageUrls,
//         brand, status, reorderPoint, customAttributes, id
//     ];
//
//     try {
//         const result = await db.query(queryText, values);
//         if (result.rowCount === 0) {
//             return res.status(404).json({ message: 'Product not found' });
//         }
//         const updatedProduct = result.rows[0];
//         await auditService.log(req.user!, 'Product Updated', `Product: "${updatedProduct.name}" (ID: ${updatedProduct.id})`);
//         res.status(200).json(toCamelCase(updatedProduct));
//     } catch (error) {
//         console.error(`Error updating product ${id}:`, error);
//         res.status(500).json({ message: 'Error updating product' });
//     }
// };

export const deleteProduct = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const productInfoResult = await db.query('SELECT name, sku FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);
        if (productInfoResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const deletedProductInfo = productInfoResult.rows[0];

        // Check for associated sales or purchase orders
        const saleUse = await db.query('SELECT COUNT(*)::int AS count FROM sale_items WHERE product_id = $1', [id]);
        const poUse = await db.query('SELECT COUNT(*)::int AS count FROM purchase_order_items WHERE product_id = $1', [id]);
        if ((saleUse.rows[0].count ?? 0) > 0 || (poUse.rows[0].count ?? 0) > 0) {
            return res.status(400).json({
                message: 'Cannot permanently delete this product because it has associated sales or purchase order history. Please archive it instead.'
            });
        }

        await db.query('DELETE FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);

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
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const productResult = await db.query('SELECT status, name FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);
        if (productResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = productResult.rows[0];
        const newStatus = product.status === 'active' ? 'archived' : 'active';

        const updateResult = await db.query('UPDATE products SET status = $1 WHERE id = $2 AND store_id = $3 RETURNING *', [newStatus, id, storeId]);

        const action = newStatus === 'archived' ? 'Product Archived' : 'Product Restored';
        await auditService.log(req.user!, action, `Product: "${product.name}" (ID: ${id})`);

        res.status(200).json(toCamelCase(updateResult.rows[0]));
    } catch (error) {
        console.error(`Error archiving product ${id}:`, error);
        res.status(500).json({ message: 'Error updating product status' });
    }
};

export const adjustStock = async (req: express.Request, res: express.Response) => {
    const { newQuantity, reason } = req.body as { newQuantity: number; reason: string };
    const { id } = req.params;

    if (typeof newQuantity !== 'number' || isNaN(newQuantity) || !reason) {
        return res.status(400).json({ message: 'newQuantity (number) and reason (string) are required.' });
    }

    try {
        const storeId = (req as any).tenant?.storeId || req.user?.currentStoreId;
        if (!storeId) {
            return res.status(400).json({ message: 'Store context required' });
        }
        const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND store_id = $2', [id, storeId]);
        if (productResult.rowCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const product = productResult.rows[0];
        const oldQuantity: number = Number(product.stock) || 0;

        let finalStock: number;
        let delta: number | null = null;

        if (reason === 'Stock Count') {
            // Absolute set; must be non-negative
            if (newQuantity < 0) {
                return res.status(400).json({ message: 'Stock Count cannot be negative.' });
            }
            finalStock = newQuantity;
            delta = finalStock - oldQuantity;
        } else if (reason === 'Quick adjustment') {
            // Quick +/- buttons send absolute stock
            finalStock = newQuantity;
            delta = finalStock - oldQuantity;
        } else {
            // Treat input as signed delta; clamp at 0
            delta = newQuantity;
            finalStock = Math.max(0, oldQuantity + newQuantity);
        }

        if (!Number.isFinite(finalStock)) {
            return res.status(400).json({ message: 'Invalid resulting stock level.' });
        }

        const updateResult = await db.query('UPDATE products SET stock = $1 WHERE id = $2 AND store_id = $3 RETURNING *', [finalStock, id, storeId]);

        const actionDetail = delta === null ? '' : ` | Change: ${delta >= 0 ? '+' : ''}${delta}`;
        await auditService.log(
            req.user!,
            'Stock Adjusted',
            `Product: "${product.name}" | From: ${oldQuantity} To: ${finalStock}${actionDetail} | Reason: ${reason}`
        );

        await accountingService.recordStockAdjustment(product, oldQuantity, reason, undefined, storeId);

        res.status(200).json(toCamelCase(updateResult.rows[0]));
    } catch (error) {
        console.error(`Error adjusting stock for product ${id}:`, error);
        res.status(500).json({ message: 'Error adjusting stock' });
    }
};
