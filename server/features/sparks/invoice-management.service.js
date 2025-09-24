/**
 * Invoice Management System
 * Handles invoice generation, storage, and management for Spark payments
 */

/**
 * Initialize invoice tables
 */
export async function initializeInvoiceTables(db) {
  try {
    // Create invoices table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        team_id TEXT,
        creator_name TEXT NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_date DATE,
        verified_by TEXT,
        verification_date DATETIME,
        subtotal REAL NOT NULL,
        commission_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        line_items TEXT NOT NULL,
        notes TEXT,
        internal_notes TEXT,
        terms_conditions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes separately
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_invoices_creator 
      ON invoices(creator_name)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_invoices_date 
      ON invoices(invoice_date)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status 
      ON invoices(status)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_invoices_number 
      ON invoices(invoice_number)
    `).run();

    // Create invoice_settings table for customization
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS invoice_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        
        -- Company details
        company_name TEXT,
        company_address TEXT,
        company_city TEXT,
        company_state TEXT,
        company_zip TEXT,
        company_country TEXT,
        company_email TEXT,
        company_phone TEXT,
        company_logo TEXT, -- Base64 encoded image
        
        -- Invoice preferences
        invoice_prefix TEXT DEFAULT 'INV',
        next_invoice_number INTEGER DEFAULT 1,
        payment_terms_days INTEGER DEFAULT 30,
        default_currency TEXT DEFAULT 'USD',
        tax_rate REAL DEFAULT 0,
        
        -- Default text
        default_notes TEXT,
        default_terms TEXT,
        
        -- Automation settings
        auto_generate_monday BOOLEAN DEFAULT 0,
        auto_send_email BOOLEAN DEFAULT 0,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, team_id)
      )
    `).run();

    // Create invoice_schedule table for automated generation
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS invoice_schedule (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        creator_name TEXT NOT NULL,
        
        -- Schedule settings
        frequency TEXT DEFAULT 'weekly', -- weekly, biweekly, monthly
        day_of_week INTEGER, -- 1=Monday, 7=Sunday
        day_of_month INTEGER,
        next_run_date DATE NOT NULL,
        last_run_date DATE,
        
        -- Status
        is_active BOOLEAN DEFAULT 1,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, team_id, creator_name)
      )
    `).run();

    console.log('Invoice tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Invoice tables initialization error:', error);
    return false;
  }
}

/**
 * Generate a unique invoice number
 */
async function generateInvoiceNumber(db, userId, teamId) {
  try {
    // Get invoice settings
    const settings = await db.prepare(`
      SELECT invoice_prefix, next_invoice_number 
      FROM invoice_settings 
      WHERE user_id = ? AND ${teamId ? 'team_id = ?' : 'team_id IS NULL'}
    `).bind(userId, ...(teamId ? [teamId] : [])).first();

    const prefix = settings?.invoice_prefix || 'INV';
    const nextNumber = settings?.next_invoice_number || 1;
    
    // Format: INV-2024-00001
    const year = new Date().getFullYear();
    const invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
    
    // Update next invoice number
    if (settings) {
      await db.prepare(`
        UPDATE invoice_settings 
        SET next_invoice_number = next_invoice_number + 1 
        WHERE user_id = ? AND ${teamId ? 'team_id = ?' : 'team_id IS NULL'}
      `).bind(userId, ...(teamId ? [teamId] : [])).run();
    } else {
      // Create default settings
      await db.prepare(`
        INSERT INTO invoice_settings (id, user_id, team_id, next_invoice_number)
        VALUES (?, ?, ?, 2)
      `).bind(
        `settings_${Date.now()}`,
        userId,
        teamId,
      ).run();
    }
    
    return invoiceNumber;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    return `INV-${Date.now()}`;
  }
}

/**
 * Create an invoice from payment data
 */
export async function createInvoice(db, invoiceData) {
  try {
    const {
      userId,
      teamId,
      creatorName,
      lineItems,
      subtotal,
      commissionAmount,
      taxAmount,
      discountAmount,
      totalAmount,
      notes,
      dueDate
    } = invoiceData;

    const invoiceNumber = await generateInvoiceNumber(db, userId, teamId);
    const id = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, user_id, team_id, creator_name,
        invoice_date, due_date, status,
        subtotal, commission_amount, tax_amount, discount_amount, total_amount,
        line_items, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      invoiceNumber,
      userId,
      teamId || null,
      creatorName,
      new Date().toISOString().split('T')[0],
      dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      'pending',
      subtotal,
      commissionAmount || 0,
      taxAmount || 0,
      discountAmount || 0,
      totalAmount,
      JSON.stringify(lineItems),
      notes || null
    ).run();

    return { success: true, id, invoiceNumber };
  } catch (error) {
    console.error('Error creating invoice:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate PDF invoice (HTML template for now, can be converted to PDF)
 */
export function generateInvoiceHTML(invoice, settings = {}) {
  const lineItems = JSON.parse(invoice.line_items || '[]');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-info { text-align: left; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 32px; color: #333; margin-bottom: 20px; }
        .invoice-details { background: #f5f5f5; padding: 15px; margin-bottom: 30px; border-radius: 5px; }
        .billing-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #4CAF50; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        .totals { text-align: right; }
        .total-row { font-size: 18px; font-weight: bold; margin-top: 10px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; }
        .status { padding: 5px 10px; border-radius: 3px; display: inline-block; }
        .status.pending { background: #FFC107; color: white; }
        .status.paid { background: #4CAF50; color: white; }
        .status.voided { background: #F44336; color: white; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h2>${settings.company_name || 'Your Company'}</h2>
          <p>${settings.company_address || ''}</p>
          <p>${settings.company_city || ''} ${settings.company_state || ''} ${settings.company_zip || ''}</p>
          <p>${settings.company_email || ''}</p>
          <p>${settings.company_phone || ''}</p>
        </div>
        <div class="invoice-info">
          <h1 class="invoice-title">INVOICE</h1>
          <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
          <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
          <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
          <p><span class="status ${invoice.status}">${invoice.status.toUpperCase()}</span></p>
        </div>
      </div>

      <div class="invoice-details">
        <div class="billing-info">
          <div>
            <h3>Bill To:</h3>
            <p><strong>${invoice.creator_name}</strong></p>
          </div>
          <div style="text-align: right;">
            <p><strong>Currency:</strong> ${invoice.currency || 'USD'}</p>
            ${invoice.payment_date ? `<p><strong>Paid On:</strong> ${new Date(invoice.payment_date).toLocaleDateString()}</p>` : ''}
            ${invoice.payment_method ? `<p><strong>Method:</strong> ${invoice.payment_method}</p>` : ''}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>$${item.rate.toFixed(2)}</td>
              <td>$${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <p><strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}</p>
        ${invoice.commission_amount > 0 ? `<p><strong>Commission:</strong> $${invoice.commission_amount.toFixed(2)}</p>` : ''}
        ${invoice.tax_amount > 0 ? `<p><strong>Tax:</strong> $${invoice.tax_amount.toFixed(2)}</p>` : ''}
        ${invoice.discount_amount > 0 ? `<p><strong>Discount:</strong> -$${invoice.discount_amount.toFixed(2)}</p>` : ''}
        <p class="total-row"><strong>Total:</strong> $${invoice.total_amount.toFixed(2)}</p>
      </div>

      ${invoice.notes ? `
        <div class="footer">
          <h3>Notes:</h3>
          <p>${invoice.notes}</p>
        </div>
      ` : ''}

      ${invoice.terms_conditions ? `
        <div class="footer">
          <h3>Terms & Conditions:</h3>
          <p>${invoice.terms_conditions}</p>
        </div>
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(db, invoiceId, status, paymentData = {}) {
  try {
    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];

    if (status === 'paid' && paymentData) {
      if (paymentData.paymentMethod) {
        updateFields.push('payment_method = ?');
        params.push(paymentData.paymentMethod);
      }
      if (paymentData.paymentDate) {
        updateFields.push('payment_date = ?');
        params.push(paymentData.paymentDate);
      }
      if (paymentData.verifiedBy) {
        updateFields.push('verified_by = ?');
        params.push(paymentData.verifiedBy);
        updateFields.push('verification_date = CURRENT_TIMESTAMP');
      }
    }

    params.push(invoiceId);

    await db.prepare(`
      UPDATE invoices 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    return { success: true };
  } catch (error) {
    console.error('Error updating invoice status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get invoices with filters
 */
export async function getInvoices(db, userId, teamId, filters = {}) {
  try {
    let query = `
      SELECT * FROM invoices 
      WHERE (user_id = ? ${teamId ? 'OR team_id = ?' : ''})
    `;
    
    const params = teamId ? [userId, teamId] : [userId];

    if (filters.creatorName) {
      query += ' AND creator_name = ?';
      params.push(filters.creatorName);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.dateFrom) {
      query += ' AND invoice_date >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND invoice_date <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY invoice_date DESC, created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const result = await db.prepare(query).bind(...params).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting invoices:', error);
    return [];
  }
}

/**
 * Handle scheduled invoice generation (for cron job)
 */
export async function generateScheduledInvoices(db) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay() || 7; // Sunday = 7
    
    // Get all active schedules due today
    const schedules = await db.prepare(`
      SELECT * FROM invoice_schedule 
      WHERE is_active = 1 
        AND next_run_date <= ?
        AND (
          (frequency = 'weekly' AND day_of_week = ?) OR
          (frequency = 'monthly' AND day_of_month = ?) OR
          frequency = 'biweekly'
        )
    `).bind(today, dayOfWeek, new Date().getDate()).all();

    const generatedInvoices = [];

    for (const schedule of schedules.results || []) {
      // Get unpaid sparks for this creator
      const sparksResult = await db.prepare(`
        SELECT * FROM sparks 
        WHERE creator = ? 
          AND status = 'active'
          AND user_id = ?
          ${schedule.team_id ? 'AND team_id = ?' : ''}
      `).bind(
        schedule.creator_name,
        schedule.user_id,
        ...(schedule.team_id ? [schedule.team_id] : [])
      ).all();

      const sparks = sparksResult.results || [];
      
      if (sparks.length > 0) {
        // Get payment settings for calculation
        const settingsResult = await db.prepare(`
          SELECT * FROM payment_settings 
          WHERE user_id = ? 
            ${schedule.team_id ? 'AND team_id = ?' : 'AND team_id IS NULL'}
            AND (
              (setting_type = 'creator' AND creator_name = ?) OR
              setting_type = 'global'
            )
          ORDER BY setting_type DESC
        `).bind(
          schedule.user_id,
          ...(schedule.team_id ? [schedule.team_id] : []),
          schedule.creator_name
        ).all();

        const settings = settingsResult.results?.[0] || {};
        const baseRate = settings.base_rate || 1;
        const commissionRate = settings.commission_rate || 0;
        const commissionType = settings.commission_type || 'percentage';

        // Calculate amounts
        const subtotal = sparks.length * baseRate;
        let commissionAmount = 0;
        
        if (commissionRate > 0) {
          if (commissionType === 'percentage') {
            commissionAmount = subtotal * (commissionRate / 100);
          } else {
            commissionAmount = sparks.length * commissionRate;
          }
        }

        // Create line items
        const lineItems = [{
          description: `Spark Videos - ${schedule.creator_name}`,
          quantity: sparks.length,
          rate: baseRate,
          amount: subtotal
        }];

        if (commissionAmount > 0) {
          lineItems.push({
            description: `Commission (${commissionRate}${commissionType === 'percentage' ? '%' : ' fixed'})`,
            quantity: 1,
            rate: commissionAmount,
            amount: commissionAmount
          });
        }

        // Create invoice
        const invoice = await createInvoice(db, {
          userId: schedule.user_id,
          teamId: schedule.team_id,
          creatorName: schedule.creator_name,
          lineItems,
          subtotal,
          commissionAmount,
          totalAmount: subtotal + commissionAmount,
          notes: `Automatically generated invoice for ${sparks.length} Spark videos`
        });

        if (invoice.success) {
          generatedInvoices.push(invoice);

          // Update schedule for next run
          let nextRunDate = new Date(schedule.next_run_date);
          
          if (schedule.frequency === 'weekly') {
            nextRunDate.setDate(nextRunDate.getDate() + 7);
          } else if (schedule.frequency === 'biweekly') {
            nextRunDate.setDate(nextRunDate.getDate() + 14);
          } else if (schedule.frequency === 'monthly') {
            nextRunDate.setMonth(nextRunDate.getMonth() + 1);
          }

          await db.prepare(`
            UPDATE invoice_schedule 
            SET last_run_date = ?, next_run_date = ?
            WHERE id = ?
          `).bind(today, nextRunDate.toISOString().split('T')[0], schedule.id).run();
        }
      }
    }

    return { success: true, generated: generatedInvoices.length };
  } catch (error) {
    console.error('Error generating scheduled invoices:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle invoice API requests
 */
export async function handleInvoiceManagement(request, env, userInfo) {
  console.log('handleInvoiceManagement called with URL:', request.url);
  const db = env.DASHBOARD_DB;
  const { userId, teamId } = userInfo;
  const url = new URL(request.url);
  const pathname = url.pathname.replace('/api/sparks', '');
  console.log('Invoice Management - pathname:', pathname, 'method:', request.method);

  // Initialize invoice tables if needed
  await initializeInvoiceTables(db);

  try {
    // GET invoice HTML/PDF (check specific paths first)
    console.log('Checking invoice PDF endpoint - pathname:', pathname);
    if (request.method === 'GET' && pathname.match(/\/invoices\/[\w-]+\/pdf/)) {
      console.log('Matched invoice PDF endpoint');
      const invoiceId = pathname.split('/')[2];
      
      const invoice = await db.prepare(
        'SELECT * FROM invoices WHERE id = ? AND (user_id = ? OR team_id = ?)'
      ).bind(invoiceId, userId, teamId).first();
      
      if (!invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const settings = await db.prepare(
        'SELECT * FROM invoice_settings WHERE user_id = ? AND ' +
        (teamId ? 'team_id = ?' : 'team_id IS NULL')
      ).bind(userId, ...(teamId ? [teamId] : [])).first();

      const html = generateInvoiceHTML(invoice, settings || {});
      
      // Return as HTML with proper headers
      return new Response(html, {
        headers: { 
          'Content-Type': 'text/html; charset=UTF-8',
          'Content-Disposition': `inline; filename="${invoice.invoice_number}.html"`
        }
      });
    }

    // PUT update invoice status (check specific paths first)
    if (request.method === 'PUT' && pathname.match(/\/invoices\/[\w-]+\/status/)) {
      const invoiceId = pathname.split('/')[2];
      const data = await request.json();
      
      const result = await updateInvoiceStatus(db, invoiceId, data.status, data.paymentData);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST create invoice
    if (request.method === 'POST' && pathname.includes('/invoices/create')) {
      const data = await request.json();
      const result = await createInvoice(db, {
        userId,
        teamId,
        ...data
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET invoices list (check last so specific paths are matched first)
    if (request.method === 'GET' && pathname === '/invoices') {
      const filters = {
        creatorName: url.searchParams.get('creator'),
        status: url.searchParams.get('status'),
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
        limit: url.searchParams.get('limit')
      };
      
      const invoices = await getInvoices(db, userId, teamId, filters);
      return new Response(JSON.stringify({ success: true, invoices }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST invoice settings
    if (request.method === 'POST' && pathname.includes('/invoices/settings')) {
      const data = await request.json();
      const id = `settings_${Date.now()}`;
      
      await db.prepare(`
        REPLACE INTO invoice_settings (
          id, user_id, team_id,
          company_name, company_address, company_city, company_state, company_zip,
          company_email, company_phone, invoice_prefix, payment_terms_days,
          tax_rate, default_notes, default_terms, auto_generate_monday
        ) VALUES (
          COALESCE((
            SELECT id FROM invoice_settings 
            WHERE user_id = ? AND ${teamId ? 'team_id = ?' : 'team_id IS NULL'}
          ), ?),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        userId,
        ...(teamId ? [teamId] : []),
        id,
        userId,
        teamId,
        data.companyName,
        data.companyAddress,
        data.companyCity,
        data.companyState,
        data.companyZip,
        data.companyEmail,
        data.companyPhone,
        data.invoicePrefix,
        data.paymentTermsDays,
        data.taxRate,
        data.defaultNotes,
        data.defaultTerms,
        data.autoGenerateMonday ? 1 : 0
      ).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST invoice schedule
    if (request.method === 'POST' && pathname.includes('/invoices/schedule')) {
      const data = await request.json();
      const id = `schedule_${Date.now()}`;
      
      // Calculate next run date
      let nextRunDate = new Date();
      if (data.frequency === 'weekly') {
        // Find next occurrence of the specified day
        const targetDay = data.dayOfWeek || 1;
        while (nextRunDate.getDay() !== targetDay % 7) {
          nextRunDate.setDate(nextRunDate.getDate() + 1);
        }
      } else if (data.frequency === 'monthly') {
        // Set to specified day of month
        nextRunDate.setDate(data.dayOfMonth || 1);
        if (nextRunDate < new Date()) {
          nextRunDate.setMonth(nextRunDate.getMonth() + 1);
        }
      }
      
      await db.prepare(`
        REPLACE INTO invoice_schedule (
          id, user_id, team_id, creator_name,
          frequency, day_of_week, day_of_month, next_run_date, is_active
        ) VALUES (
          COALESCE((
            SELECT id FROM invoice_schedule 
            WHERE user_id = ? AND ${teamId ? 'team_id = ?' : 'team_id IS NULL'}
              AND creator_name = ?
          ), ?),
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        userId,
        ...(teamId ? [teamId] : []),
        data.creatorName,
        id,
        userId,
        teamId,
        data.creatorName,
        data.frequency,
        data.dayOfWeek,
        data.dayOfMonth,
        nextRunDate.toISOString().split('T')[0],
        1
      ).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid invoice endpoint' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Invoice management API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}