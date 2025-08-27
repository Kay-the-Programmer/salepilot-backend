import db from './db_client';

async function initializeDatabase() {
    console.log('--- Initializing Database Tables / Migrations ---');
    const client = await (db as any)._pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // Ensure users table exists for authentication
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin','staff','inventory_manager'))
            );
        `);

        // --- Minimal, idempotent migrations to align schema with current code ---
        // Ensure unit_of_measure exists on products for KG support
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
        `);
        await client.query(`
            ALTER TABLE products
            ALTER COLUMN unit_of_measure SET DEFAULT 'unit';
        `);
        await client.query(`
            UPDATE products SET unit_of_measure = 'unit' WHERE unit_of_measure IS NULL;
        `);

        // (Optional) Ensure stock is decimal to allow fractional kilos. Safe to skip if already correct.
        // Only attempt change when current type is integer
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'products' AND column_name = 'stock' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE products ALTER COLUMN stock TYPE DECIMAL(10, 3) USING stock::DECIMAL(10,3);
                END IF;
            END$$;
        `);

        // Ensure columns used by products.controller exist in products table
        // Ensure status column exists and defaults to 'active' and backfill nulls
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS status TEXT;
        `);
        await client.query(`
            ALTER TABLE products
            ALTER COLUMN status SET DEFAULT 'active';
        `);
        await client.query(`
            UPDATE products SET status = 'active' WHERE status IS NULL;
        `);

        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);
        `);
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS dimensions TEXT;
        `);
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS safety_stock INT;
        `);
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS variants JSONB;
        `);
        await client.query(`
            ALTER TABLE products
            ALTER COLUMN variants SET DEFAULT '[]';
        `);
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS custom_attributes JSONB;
        `);
        await client.query(`
            ALTER TABLE products
            ALTER COLUMN custom_attributes SET DEFAULT '{}';
        `);

        // Existing initialization creating supplier tables (kept for backward compat)
        await client.query(`
            CREATE TABLE IF NOT EXISTS supplier_invoices (
                id VARCHAR(50) PRIMARY KEY,
                invoice_number VARCHAR(50) NOT NULL,
                supplier_id VARCHAR(50),
                supplier_name VARCHAR(100) NOT NULL,
                purchase_order_id VARCHAR(50),
                po_number VARCHAR(50),
                invoice_date DATE NOT NULL,
                due_date DATE NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                amount_paid DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'unpaid',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS supplier_payments (
                id VARCHAR(50) PRIMARY KEY,
                supplier_invoice_id VARCHAR(50) REFERENCES supplier_invoices(id),
                date DATE NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                method VARCHAR(50) NOT NULL,
                reference VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- Stock Takes tables ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS stock_takes (
                id TEXT PRIMARY KEY,
                start_time TIMESTAMPTZ NOT NULL,
                end_time TIMESTAMPTZ,
                status TEXT NOT NULL
            );
        `);

        // Ensure sale_items.quantity supports fractional quantities (e.g., 0.5 kg)
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sale_items' AND column_name = 'quantity' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE sale_items ALTER COLUMN quantity TYPE DECIMAL(10, 3) USING quantity::DECIMAL(10,3);
                END IF;
            END$$;
        `);

        // Ensure return_items.quantity supports fractional quantities
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'return_items' AND column_name = 'quantity' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE return_items ALTER COLUMN quantity TYPE DECIMAL(10, 3) USING quantity::DECIMAL(10,3);
                END IF;
            END$$;
        `);

        // Ensure purchase_order_items quantities support fractional values
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'purchase_order_items' AND column_name = 'quantity' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE purchase_order_items ALTER COLUMN quantity TYPE DECIMAL(10, 3) USING quantity::DECIMAL(10,3);
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'purchase_order_items' AND column_name = 'received_quantity' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE purchase_order_items ALTER COLUMN received_quantity TYPE DECIMAL(10, 3) USING received_quantity::DECIMAL(10,3);
                END IF;
            END$$;
        `);

        // Ensure status constraint matches expected values (best-effort without error on duplicates)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'stock_takes' AND constraint_type = 'CHECK'
                ) THEN
                    ALTER TABLE stock_takes
                    ADD CONSTRAINT stock_takes_status_check CHECK (status IN ('active', 'completed'));
                END IF;
            END$$;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS stock_take_items (
                id SERIAL PRIMARY KEY,
                stock_take_id TEXT NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL REFERENCES products(id),
                name TEXT NOT NULL,
                sku TEXT NOT NULL,
                expected DECIMAL(10, 3) NOT NULL,
                counted DECIMAL(10, 3)
            );
        `);

        // Ensure expected/counted are decimal in case of legacy integer columns
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'stock_take_items' AND column_name = 'expected' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE stock_take_items ALTER COLUMN expected TYPE DECIMAL(10, 3) USING expected::DECIMAL(10,3);
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'stock_take_items' AND column_name = 'counted' AND data_type IN ('integer', 'smallint', 'bigint')
                ) THEN
                    ALTER TABLE stock_take_items ALTER COLUMN counted TYPE DECIMAL(10, 3) USING counted::DECIMAL(10,3);
                END IF;
            END$$;
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_take_items_stock_take_id ON stock_take_items(stock_take_id);
        `);

        await client.query('COMMIT'); // Commit transaction
        console.log('✅ Database schema verified/updated successfully');
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('❌ Error initializing database:', error);
    } finally {
        client.release(); // Release the client back to the pool, but don't end the pool
    }
}

// Run the initialization
initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});
