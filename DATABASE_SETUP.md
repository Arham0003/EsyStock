# Database Setup and Migration

This document explains how to set up the database and apply the required migrations for the Local Stock application.

## Prerequisites

1. Node.js (version 14 or higher)
2. Access to a PostgreSQL database (local or remote)
3. Database connection details (host, port, database name, username, password)

## Applying the Customer Fields Migration

The Local Stock application requires a database migration to add customer information fields to the sales table. Follow these steps to apply the migration:

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Database Connection Details

You can set the database connection details in one of two ways:

#### Option A: Environment Variables

Set the following environment variables:

```bash
DB_HOST=your-database-host
DB_PORT=your-database-port (default: 5432)
DB_NAME=your-database-name
DB_USER=your-database-username
DB_PASSWORD=your-database-password
```

#### Option B: Create a .env file

Create a `.env` file in the project root with the following content:

```env
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-username
DB_PASSWORD=your-database-password
```

### 3. Run the Migration Script

```bash
npm run apply-migration
```

Or directly:

```bash
node apply-migration.js
```

### 4. Verify the Migration

After running the script, you can verify that the migration was applied successfully by checking that the `sales` table now has the following columns:
- `customer_name` (TEXT)
- `customer_phone` (TEXT)
- `customer_email` (TEXT)

## Troubleshooting

### Common Issues

1. **Connection Refused**: Make sure your database is running and accessible from your machine.

2. **Authentication Failed**: Verify that your database credentials are correct.

3. **Permission Denied**: Ensure that the database user has the necessary permissions to alter tables.

4. **Table Not Found**: Make sure the `sales` table exists in your database.

### Manual Migration

If the script doesn't work, you can apply the migration manually by connecting to your database and running the SQL commands from `supabase/migrations/20250925100000_add_customer_fields_to_sales.sql`:

```sql
-- Add customer fields to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add indexes for better query performance on customer fields
CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON public.sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON public.sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sales_customer_email ON public.sales(customer_email);
```

## Alternative: Using Supabase CLI

If you have Docker and the Supabase CLI installed, you can also apply the migration using:

```bash
supabase link --project-ref your-project-ref
supabase migration up
```

Note: This requires Docker Desktop to be installed and running.