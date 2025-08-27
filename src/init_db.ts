import db from './db_client';
import bcrypt from 'bcryptjs';

async function initializeDatabase() {
    console.log('--- Initializing Database Tables / Migrations ---');
    const client = await (db as any)._pool.connect();

    try {
        // Phase A: Ensure critical auth table exists and is committed independently
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin','staff','inventory_manager'))
            );
        `);
        // Seed a default admin user if none exists (safe, idempotent)
        const existingUsers = await client.query('SELECT 1 FROM users LIMIT 1');
        if (existingUsers.rowCount === 0) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('password', salt);
            await client.query(
                'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
                ['user_admin_default', 'Admin User', 'admin@sale-pilot.com', passwordHash, 'admin']
            );
            console.log('✅ Default admin user created (admin@sale-pilot.com / password)');
        }
        await client.query('COMMIT');

        // Phase B: Best-effort optional migrations; guard against missing tables
        // Ensure unit_of_measure/status/etc only if products table exists
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'products'
                ) THEN
                    BEGIN
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
                        ALTER TABLE products ALTER COLUMN unit_of_measure SET DEFAULT 'unit';
                        UPDATE products SET unit_of_measure = 'unit' WHERE unit_of_measure IS NULL;

                        -- Ensure columns used by products.controller exist in products table
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT;
                        ALTER TABLE products ALTER COLUMN status SET DEFAULT 'active';
                        UPDATE products SET status = 'active' WHERE status IS NULL;

                        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions TEXT;
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS safety_stock INT;
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB;
                        ALTER TABLE products ALTER COLUMN variants SET DEFAULT '[]';
                        ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_attributes JSONB;
                        ALTER TABLE products ALTER COLUMN custom_attributes SET DEFAULT '{}';
                    EXCEPTION WHEN others THEN
                        -- Swallow any unexpected errors to avoid aborting init
                        NULL;
                    END;
                END IF;
            END$$;
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
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_takes'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = 'stock_takes' AND constraint_type = 'CHECK'
                    ) THEN
                        ALTER TABLE stock_takes
                        ADD CONSTRAINT stock_takes_status_check CHECK (status IN ('active', 'completed'));
                    END IF;
                END IF;
            END$$;
        `);

        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'products'
                ) THEN
                    CREATE TABLE IF NOT EXISTS stock_take_items (
                        id SERIAL PRIMARY KEY,
                        stock_take_id TEXT NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
                        product_id TEXT NOT NULL REFERENCES products(id),
                        name TEXT NOT NULL,
                        sku TEXT NOT NULL,
                        expected DECIMAL(10, 3) NOT NULL,
                        counted DECIMAL(10, 3)
                    );
                END IF;
            END$$;
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

        console.log('✅ Database schema verified/updated successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
    } finally {
        client.release(); // Release the client back to the pool, but don't end the pool
    }
}

// Run the initialization
initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});
