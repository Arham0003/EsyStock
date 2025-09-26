# Vercel Deployment Guide

This guide explains how to deploy the Local Stock application to Vercel and resolve the database migration issue.

## Deploying to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically detect the project settings and deploy the frontend

## Resolving the Database Issue

After deploying to Vercel, you may still encounter the "Could not find the customer name column" error. This happens because the database migration hasn't been applied to your Supabase project yet.

### Steps to Fix the Database Issue

1. Go to the [Supabase Dashboard](https://app.supabase.com/project/yuqvtucvqivvvpcfflhq/sql)
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the following SQL code:
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
5. Click "Run" to execute the query
6. You should see a success message indicating the columns were added

### Verifying the Fix

1. Refresh your Vercel deployment
2. Try recording a sale with customer information
3. The error should no longer appear

## Environment Variables

Make sure your Vercel project has the correct environment variables:
- `VITE_SUPABASE_URL` - Should match the Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Should match the Supabase anon key

These should already be set if you used the automatic Vercel integration with Supabase.

## Troubleshooting

If you still encounter issues:

1. Check that the database migration was applied successfully by running:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'sales' 
   AND column_name IN ('customer_name', 'customer_phone', 'customer_email');
   ```

2. Make sure your Supabase project URL and keys in Vercel match those in your `client.ts` file

3. Restart your Vercel deployment if needed