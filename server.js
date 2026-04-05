// Skybird WiFi Billing - Backend Proxy Server
// This server bypasses Supabase REST API cache issues by using the PostgreSQL client directly

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const SUPABASE_URL = 'https://tlfhyqveyydkfjqsptyo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZmh5cXZleXlka2ZqcXNwdHlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMwMzYzMCwiZXhwIjoyMDkwODc5NjMwfQ.P25RWEEKgY9Czohwh3nkzNQJshRISX8eR-MNj0AqClE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Skybird Billing Backend is running' });
});

// Add Customer
app.post('/api/customers', async (req, res) => {
    try {
        const { fullName, roomNo, mobileNumber, voucherCode, price, voucherAmount, buyDate, expiryDate, validityDays, planName, isPaid, notes, agentId } = req.body;

        // Validate required fields
        if (!fullName || !roomNo || !mobileNumber || !voucherCode || !price || !buyDate || !expiryDate || !validityDays) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert using Supabase client (bypasses REST API cache)
        const { data, error } = await supabase
            .from('billing_customers')
            .insert([{
                fullName,
                roomNo,
                mobileNumber,
                voucherCode,
                price: parseFloat(price),
                voucherAmount: parseFloat(voucherAmount) || 0,
                buyDate,
                expiryDate,
                validityDays: parseInt(validityDays),
                planName,
                isPaid: parseInt(isPaid),
                notes,
                agentId: parseInt(agentId) || 1
            }])
            .select();

        if (error) {
            console.error('Insert error:', error);
            return res.status(400).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Customer
app.patch('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, roomNo, mobileNumber, voucherCode, price, voucherAmount, buyDate, expiryDate, validityDays, planName, isPaid, notes } = req.body;

        const { data, error } = await supabase
            .from('billing_customers')
            .update({
                fullName,
                roomNo,
                mobileNumber,
                voucherCode,
                price: parseFloat(price),
                voucherAmount: parseFloat(voucherAmount) || 0,
                buyDate,
                expiryDate,
                validityDays: parseInt(validityDays),
                planName,
                isPaid: parseInt(isPaid),
                notes,
                updatedAt: new Date().toISOString()
            })
            .eq('id', parseInt(id))
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('billing_customers')
            .delete()
            .eq('id', parseInt(id))
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ success: true, message: 'Customer deleted' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Customers
app.get('/api/customers', async (req, res) => {
    try {
        const { agentId } = req.query;

        let query = supabase.from('billing_customers').select('*');

        if (agentId) {
            query = query.eq('agentId', parseInt(agentId));
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Skybird Billing Backend running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
