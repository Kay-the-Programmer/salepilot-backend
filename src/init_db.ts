import db from './db_client';
import bcrypt from 'bcryptjs';

function genId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

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

        // Phase B0: Create core tables for a brand-new database (idempotent)
        // Suppliers
        await client.query(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                payment_terms TEXT,
                banking_details TEXT,
                notes TEXT
            );
        `);
        // Categories
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                attributes JSONB NOT NULL DEFAULT '[]',
                revenue_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
                cogs_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
            );
        `);
        // Accounts (needed for references above)
        await client.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                number TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
                sub_type TEXT UNIQUE CHECK (sub_type IN ('cash','accounts_receivable','inventory','accounts_payable','sales_tax_payable','sales_revenue','cogs','store_credit_payable','inventory_adjustment', NULL)),
                balance DECIMAL(12,2) NOT NULL DEFAULT 0,
                is_debit_normal BOOLEAN NOT NULL,
                description TEXT
            );
        `);
        // Products
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                sku TEXT NOT NULL UNIQUE,
                barcode TEXT UNIQUE,
                category_id TEXT REFERENCES categories(id),
                supplier_id TEXT REFERENCES suppliers(id),
                price DECIMAL(10,2) NOT NULL,
                cost_price DECIMAL(10,2),
                stock DECIMAL(10,3) NOT NULL DEFAULT 0,
                unit_of_measure TEXT NOT NULL DEFAULT 'unit' CHECK (unit_of_measure IN ('unit','kg')),
                image_urls TEXT[],
                brand TEXT,
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
                reorder_point INT,
                weight DECIMAL(10,3),
                dimensions TEXT,
                safety_stock INT,
                variants JSONB DEFAULT '[]',
                custom_attributes JSONB
            );
        `);
        // Customers
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                address JSONB,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                store_credit DECIMAL(10,2) NOT NULL DEFAULT 0,
                account_balance DECIMAL(10,2) NOT NULL DEFAULT 0
            );
        `);
        // Sales and related
        await client.query(`
            CREATE TABLE IF NOT EXISTS sales (
                transaction_id TEXT PRIMARY KEY,
                "timestamp" TIMESTAMPTZ NOT NULL,
                customer_id TEXT REFERENCES customers(id),
                total DECIMAL(10,2) NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) NOT NULL,
                discount DECIMAL(10,2) NOT NULL,
                store_credit_used DECIMAL(10,2),
                payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partially_paid')),
                amount_paid DECIMAL(10,2) NOT NULL,
                due_date DATE,
                refund_status TEXT NOT NULL DEFAULT 'none'
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id SERIAL PRIMARY KEY,
                sale_id TEXT NOT NULL REFERENCES sales(transaction_id) ON DELETE CASCADE,
                product_id TEXT NOT NULL REFERENCES products(id),
                quantity DECIMAL(10,3) NOT NULL,
                price_at_sale DECIMAL(10,2) NOT NULL,
                cost_at_sale DECIMAL(10,2)
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                sale_id TEXT NOT NULL REFERENCES sales(transaction_id) ON DELETE CASCADE,
                date TIMESTAMPTZ NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                method TEXT NOT NULL
            );
        `);
        // Returns
        await client.query(`
            CREATE TABLE IF NOT EXISTS returns (
                id TEXT PRIMARY KEY,
                original_sale_id TEXT NOT NULL REFERENCES sales(transaction_id),
                "timestamp" TIMESTAMPTZ NOT NULL,
                refund_amount DECIMAL(10,2) NOT NULL,
                refund_method TEXT NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS return_items (
                id SERIAL PRIMARY KEY,
                return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL REFERENCES products(id),
                product_name TEXT NOT NULL,
                quantity DECIMAL(10,3) NOT NULL,
                reason TEXT,
                add_to_stock BOOLEAN NOT NULL DEFAULT FALSE
            );
        `);
        // Accounting journal
        await client.query(`
            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                "date" TIMESTAMPTZ NOT NULL,
                description TEXT NOT NULL,
                source_type TEXT NOT NULL CHECK (source_type IN ('sale','purchase','manual','payment')),
                source_id TEXT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS journal_entry_lines (
                id SERIAL PRIMARY KEY,
                journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                type TEXT NOT NULL CHECK (type IN ('debit','credit')),
                amount DECIMAL(10,2) NOT NULL,
                account_name TEXT NOT NULL
            );
        `);
        // Audit logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                "timestamp" TIMESTAMPTZ NOT NULL,
                user_id TEXT NOT NULL REFERENCES users(id),
                user_name TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT NOT NULL
            );
        `);
        // Store settings (singleton)
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_settings (
                id INT PRIMARY KEY DEFAULT 1,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                tax_rate DECIMAL(5,2) NOT NULL,
                currency JSONB NOT NULL,
                receipt_message TEXT,
                low_stock_threshold INT NOT NULL,
                sku_prefix TEXT,
                enable_store_credit BOOLEAN NOT NULL,
                payment_methods JSONB,
                supplier_payment_methods JSONB,
                CONSTRAINT single_row_check CHECK (id = 1)
            );
        `);
        // Purchase orders
        await client.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id TEXT PRIMARY KEY,
                po_number TEXT NOT NULL UNIQUE,
                supplier_id TEXT NOT NULL REFERENCES suppliers(id),
                supplier_name TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('draft','ordered','partially_received','received','canceled')),
                created_at TIMESTAMPTZ NOT NULL,
                ordered_at TIMESTAMPTZ,
                expected_at TIMESTAMPTZ,
                received_at TIMESTAMPTZ,
                notes TEXT,
                subtotal DECIMAL(10,2) NOT NULL,
                shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
                tax DECIMAL(10,2) NOT NULL DEFAULT 0,
                total DECIMAL(10,2) NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS purchase_order_items (
                id SERIAL PRIMARY KEY,
                po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL REFERENCES products(id),
                product_name TEXT NOT NULL,
                sku TEXT NOT NULL,
                quantity DECIMAL(10,3) NOT NULL,
                cost_price DECIMAL(10,2) NOT NULL,
                received_quantity DECIMAL(10,3) NOT NULL DEFAULT 0
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS po_receptions (
                id SERIAL PRIMARY KEY,
                po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                reception_date TIMESTAMPTZ NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS po_reception_items (
                id SERIAL PRIMARY KEY,
                reception_id INT NOT NULL REFERENCES po_receptions(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL REFERENCES products(id),
                product_name TEXT NOT NULL,
                quantity_received DECIMAL(10,3) NOT NULL
            );
        `);

        // Phase B: Seed minimal demo data on empty database (idempotent inserts)
        // Seed default store settings
        await client.query(`
            INSERT INTO store_settings (id, name, address, phone, email, website, tax_rate, currency, receipt_message, low_stock_threshold, sku_prefix, enable_store_credit, payment_methods, supplier_payment_methods)
            VALUES (1, 'SalePilot Gourmet Market', '456 Commerce Ave, San Francisco, CA 94103', '(123) 555-1234', 'hello@spgourmet.com', 'https://spgourmet.com', 8.5,
                    '{"symbol":"$","code":"USD","position":"before"}', 'Thank you for shopping with us!', 15, 'SPGM-', true,
                    '[{"id":"cash","name":"Cash"},{"id":"card","name":"Credit/Debit Card"}]',
                    '[{"id":"bank_transfer","name":"Bank Transfer"},{"id":"check","name":"Check"}]')
            ON CONFLICT (id) DO NOTHING;
        `);

        // Seed accounts (Chart of Accounts)
        const accounts = [
            { number: '1010', name: 'Cash on Hand', type: 'asset', sub: 'cash', debit: true, desc: 'Physical cash and cash equivalents in the register.' },
            { number: '1100', name: 'Accounts Receivable', type: 'asset', sub: 'accounts_receivable', debit: true, desc: 'Money owed to the business by customers.' },
            { number: '1200', name: 'Inventory', type: 'asset', sub: 'inventory', debit: true, desc: 'Value of all products available for sale.' },
            { number: '2010', name: 'Accounts Payable', type: 'liability', sub: 'accounts_payable', debit: false, desc: 'Money owed to suppliers for inventory.' },
            { number: '2200', name: 'Sales Tax Payable', type: 'liability', sub: 'sales_tax_payable', debit: false, desc: 'Sales tax collected, to be remitted to the government.' },
            { number: '2300', name: 'Store Credit Payable', type: 'liability', sub: 'store_credit_payable', debit: false, desc: 'Total outstanding store credit owed to customers.' },
            { number: '3010', name: "Owner's Equity", type: 'equity', sub: null, debit: false, desc: 'Initial investment and retained earnings.' },
            { number: '4010', name: 'Sales Revenue', type: 'revenue', sub: 'sales_revenue', debit: false, desc: 'Default account for revenue from sales.' },
            { number: '5010', name: 'Cost of Goods Sold', type: 'expense', sub: 'cogs', debit: true, desc: 'Default account for the cost of goods sold.' },
            { number: '6010', name: 'Rent Expense', type: 'expense', sub: null, debit: true, desc: 'Monthly rent for the store premises.' },
            { number: '6020', name: 'Inventory Adjustment Expense', type: 'expense', sub: 'inventory_adjustment', debit: true, desc: 'Expense from inventory shrinkage, damage, or adjustments.' }
        ];
        for (const a of accounts) {
            await client.query(
                'INSERT INTO accounts (id, name, number, type, sub_type, is_debit_normal, description, balance) VALUES ($1,$2,$3,$4,$5,$6,$7,0) ON CONFLICT(number) DO NOTHING',
                [genId('acc'), a.name, a.number, a.type, a.sub, a.debit, a.desc]
            );
        }

        // Seed suppliers
        const supplierDefs = [
            { name: 'World Coffee Importers', contact: 'John Bean', email: 'sales@wcoffee.com', terms: 'Net 30' },
            { name: 'Green Leaf Teas', contact: 'Jane Steep', email: 'contact@greenleaf.com', terms: 'Net 15' },
            { name: 'Local Mill & Co.', contact: 'Bob Miller', email: 'orders@localmill.com', terms: 'COD' }
        ];
        const supplierIds: Record<string,string> = {};
        for (const s of supplierDefs) {
            const found = await client.query('SELECT id FROM suppliers WHERE name = $1', [s.name]);
            if (found.rowCount && found.rows[0]) {
                supplierIds[s.name] = found.rows[0].id;
            } else {
                const id = genId('sup');
                await client.query('INSERT INTO suppliers (id, name, contact_person, email, payment_terms) VALUES ($1,$2,$3,$4,$5)', [id, s.name, s.contact, s.email, s.terms]);
                supplierIds[s.name] = id;
            }
        }

        // Seed categories
        const categoryDefs = ['Beverages','Bakery'];
        const categoryIds: Record<string,string> = {};
        for (const cname of categoryDefs) {
            const found = await client.query('SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL', [cname]);
            if (found.rowCount && found.rows[0]) {
                categoryIds[cname] = found.rows[0].id;
            } else {
                const id = genId('cat');
                await client.query('INSERT INTO categories (id, name, parent_id, attributes) VALUES ($1,$2,$3,$4)', [id, cname, null, '[]']);
                categoryIds[cname] = id;
            }
        }

        // Seed a few sample products if table is empty
        const existingProducts = await client.query('SELECT 1 FROM products LIMIT 1');
        if (existingProducts.rowCount === 0) {
            const samples = [
                { name: 'Premium Blend Coffee', description: 'A rich, full-bodied blend of Arabica beans from South America.', sku: 'SP-84321', barcode: '888000011122', category: 'Beverages', price: 18.99, cost: 12.50, stock: 50, supplier: 'World Coffee Importers', brand: 'Global Roast', status: 'active' },
                { name: 'Organic Green Tea', description: 'Delicate and refreshing green tea, sourced from the finest gardens.', sku: 'SP-19874', barcode: '888000011133', category: 'Beverages', price: 12.49, cost: 8.00, stock: 75, supplier: 'Green Leaf Teas', brand: 'Zen Garden', status: 'active' },
                { name: 'Artisan Sourdough Bread', description: 'Naturally leavened sourdough with a crispy crust and chewy interior.', sku: 'SP-33215', barcode: '888000011144', category: 'Bakery', price: 6.99, cost: 3.50, stock: 25, supplier: 'Local Mill & Co.', brand: 'The Bakehouse', status: 'active' },
                { name: 'Gourmet Chocolate Bar', description: '70% dark chocolate with hints of sea salt.', sku: 'SP-54321', barcode: null, category: 'Bakery', price: 5.99, cost: 2.50, stock: 100, supplier: null, brand: null, status: 'active' }
            ];
            for (const p of samples) {
                await client.query(
                    `INSERT INTO products (id, name, description, sku, barcode, category_id, supplier_id, price, cost_price, stock, image_urls, brand, status)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                     ON CONFLICT (sku) DO NOTHING`,
                    [genId('prod'), p.name, p.description, p.sku, p.barcode, p.category ? categoryIds[p.category] : null, p.supplier ? supplierIds[p.supplier!] : null, p.price, p.cost, p.stock, JSON.stringify(['/images/salepilot.png']), p.brand, p.status]
                );
            }
        }

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
