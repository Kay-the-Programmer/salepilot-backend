import db from './db_client';

async function initializeDatabase() {
    console.log('--- Initializing Database Tables ---');
    const client = await (db as any)._pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // Create supplier_invoices table if it doesn't exist
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

        // Create supplier_payments table if it doesn't exist
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

        await client.query('COMMIT'); // Commit transaction
        console.log('✅ Database tables created successfully');
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
