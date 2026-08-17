
class ThermalPrinterService {
  constructor() {
    this.printerWidth = 38; // Optimized width for TVS RP-3160 Gold 80mm printer
    this.leftMargin = '  '; // 2 spaces for left margin (~5px)
    this.isElectron = typeof window !== 'undefined' && window.electronAPI;
  }

  // Format text to fit thermal printer width
  formatLine(text, align = 'center') {
    const maxWidth = this.printerWidth;
    if (text.length > maxWidth) {
      return this.leftMargin + text.substring(0, maxWidth);
    }
    
    switch (align) {
      case 'center':
        const padding = Math.floor((maxWidth - text.length) / 2);
        // Use spaces for centering, but ensure it doesn't get trimmed
        return this.leftMargin + ' '.repeat(Math.max(0, padding)) + text + ' '.repeat(Math.max(0, padding));
      case 'right':
        return this.leftMargin + ' '.repeat(Math.max(0, maxWidth - text.length)) + text;
      default:
        return this.leftMargin + text; // Left align with margin
    }
  }

  // Format two-column line (left and right aligned)
  formatTwoColumn(left, right) {
    const maxWidth = this.printerWidth;
    const rightWidth = right.length + 1; // +1 for space separator
    const leftWidth = maxWidth - rightWidth;
    
    return (
      this.leftMargin +
      left.substring(0, leftWidth).padEnd(leftWidth) +
      ' ' +
      right
    );
  }

  // Create separator line
  createSeparator(char = '-') {
    return this.leftMargin + char.repeat(this.printerWidth);
  }

  // Generate thermal printer formatted receipt
  generateThermalReceipt(paymentData) {
    // Aggregate duplicate items by name and price
    const aggregatedItems = paymentData.cartItems.reduce((acc, item) => {
      const existingItem = acc.find(i => i.name === item.name && i.price === item.price)
      if (existingItem) {
        existingItem.quantity += item.quantity
      } else {
        acc.push({ ...item })
      }
      return acc
    }, [])
    
    const lines = [];
    
    // Header - Hotel Info (CENTERED)
    lines.push(this.formatLine('JAGALI KOOTA', 'center'));
    lines.push(this.formatLine('MYSURU', 'center'));
    lines.push('');
    
    // Service type and counter - Dynamic based on order type
    let serviceType = 'SELF SERVICE';
    console.log('🖨️ Thermal printer - determining service type:', {
      selectedTable: paymentData.selectedTable,
      tableNumber: paymentData.selectedTable?.tableNumber || paymentData.selectedTable?.number,
      selectedCategory: paymentData.selectedCategory,
      categoryName: paymentData.selectedCategory?.name,
      fullPaymentData: paymentData
    });
    
    if (paymentData.selectedTable && (paymentData.selectedTable.tableNumber || paymentData.selectedTable.number)) {
      serviceType = 'RESTAURANT';
      console.log('🖨️ Service type set to RESTAURANT (has table)');
    } else if (paymentData.selectedCategory) {
      const categoryName = paymentData.selectedCategory.name?.toLowerCase() || '';
      if (categoryName.includes('restaurant')) {
        serviceType = 'RESTAURANT';
        console.log('🖨️ Service type set to RESTAURANT (category)');
      } else if (categoryName.includes('temple') || categoryName.includes('meal')) {
        serviceType = 'TEMPLE MEALS';
        console.log('🖨️ Service type set to TEMPLE MEALS');
      } else if (categoryName.includes('darshini') || categoryName.includes('self service')) {
        serviceType = 'SELF SERVICE';
        console.log('🖨️ Service type set to SELF SERVICE');
      }
    }
    
    console.log('🖨️ Final service type for receipt:', serviceType);
    
    // Determine right corner text (table number if available)
    let rightCornerText = '';
    if (paymentData.selectedTable && (paymentData.selectedTable.tableNumber || paymentData.selectedTable.number)) {
      rightCornerText = `Table ${paymentData.selectedTable.tableNumber || paymentData.selectedTable.number}`;
    }

    if (rightCornerText) {
      lines.push(this.formatTwoColumn('', rightCornerText));
    }
    lines.push(this.createSeparator('-'));
    
    // Date (right aligned) and Bill number (left aligned) - separate lines
    let formattedDate = 'NaN-NaN-NaN'; // Default fallback
    try {
      const dateObj = paymentData.date ? new Date(paymentData.date) : new Date();
      
      // Check if date is valid
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
      } else {
        // If paymentData.date is invalid, use current date
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      // Use current date as fallback
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
    }
    
    // Format time
    let formattedTime = '';
    try {
      const timeObj = paymentData.time ? new Date(`1970-01-01 ${paymentData.time}`) : new Date();
      if (!isNaN(timeObj.getTime()) && paymentData.time) {
        formattedTime = paymentData.time;
      } else {
        // Use current time
        formattedTime = new Date().toLocaleTimeString('en-IN', { 
          hour12: true, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    } catch (error) {
      console.error('Time formatting error:', error);
      formattedTime = new Date().toLocaleTimeString('en-IN', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    lines.push(this.formatTwoColumn(formattedDate, formattedTime));
    
    // Debug: Log what unified bill/invoice number we're using
    console.log('🖨️ Thermal printer unified bill/invoice number debug:', {
      paymentDataInvoiceNumber: paymentData.invoiceNumber,
      paymentDataBillNumber: paymentData.billNumber,
      note: 'Bill No and Invoice No should be the same',
      fallbackValue: paymentData.invoiceNumber || paymentData.billNumber || '001',
      finalValue: String(paymentData.invoiceNumber || paymentData.billNumber || '001')
    });
    
    // Use unified number (invoice and bill are the same) - 3-digit format
    const unifiedNumber = paymentData.invoiceNumber || paymentData.billNumber || '001';
    lines.push(this.leftMargin + 'BILL NO: ' + String(unifiedNumber));
    
    // Add bill generation timestamp
    const billGenTime = new Date().toLocaleTimeString('en-IN', { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    lines.push(this.leftMargin + `Bill Generated: ${billGenTime}`);
    lines.push(this.createSeparator('-'));
    
    // Items header - two column style
    lines.push(this.formatTwoColumn('ITEM NAME', 'QTY  RATE  AMOUNT'));
    lines.push(this.createSeparator('-'));
    
    // Items - use aggregated items
    aggregatedItems.forEach(item => {
      // Clean item name - remove leading numbers and spaces (001TEA -> TEA, 018 KESARI BATH -> KESARI BATH)
      let cleanItemName = item.name.replace(/^\d+\s*/, '').toUpperCase();
      const qty = parseFloat(item.quantity).toFixed(3);
      const rate = parseFloat(item.price).toFixed(2);
      const amount = parseFloat(item.price * item.quantity).toFixed(2);
      
      // Item name on one line
      lines.push(this.leftMargin + cleanItemName);
      
      // Quantity, rate, amount right-aligned on next line
      const qtyRateAmount = `${qty}  ${rate}  ${amount}`;
      lines.push(this.formatLine(qtyRateAmount, 'right'));
    });
    
    lines.push(this.createSeparator('-'));
    
    // Subtotal - use aggregated items
    const subtotal = aggregatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    lines.push(this.formatTwoColumn('SUBTOTAL:', `₹${parseFloat(subtotal).toFixed(2)}`));

    // GST Amount
    const totalGST = aggregatedItems.reduce((sum, item) => {
      const rate = item.gstRate || 0;
      return sum + ((item.price * item.quantity * rate) / 100);
    }, 0);
    if (totalGST > 0) {
      lines.push(this.formatTwoColumn('GST AMOUNT:', `₹${parseFloat(totalGST).toFixed(2)}`));
    }
    
    // Discount (if applied)
    if (paymentData.discountAmount && paymentData.discountAmount > 0) {
      lines.push(this.formatTwoColumn('DISCOUNT:', `-₹${parseFloat(paymentData.discountAmount).toFixed(2)}`));
      
      // Show discount reason if available
      if (paymentData.discountRemark || paymentData.discount?.remark) {
        const remark = paymentData.discountRemark || paymentData.discount?.remark || '';
        if (remark.length > 0) {
          lines.push(this.leftMargin + `Reason: ${remark}`);
        }
      }
    }
    
    lines.push(this.createSeparator('-'));
    
    // GRAND TOTAL (subtotal + GST - discount)
    const total = subtotal + totalGST - (paymentData.discountAmount || 0);
    lines.push(this.formatTwoColumn('\x1B\x45\x01GRAND TOTAL:\x1B\x45\x00', `\x1B\x45\x01₹${parseFloat(total).toFixed(2)}\x1B\x45\x00`));
    lines.push(this.createSeparator('-'));
    
    // Payment Details
    if (paymentData.paymentMethod !== 'Pending') {
      lines.push(this.formatTwoColumn('PAYMENT:', paymentData.paymentMethod.toUpperCase()));
    }
    
    // Footer - centered
    lines.push(this.formatLine('.. !! THANK YOU,VISIT AGAIN !!..', 'center'));
    
    // Remove invoice number at the end - users don't want duplicate
    // const finalInvoiceNumber = paymentData.invoiceNumber || paymentData.billNumber || '001';
    // lines.push(this.leftMargin + `Invoice No:${finalInvoiceNumber}`);
    
    // Paper cutting lines
    lines.push('');
    lines.push('');
    
    return lines.join('\n');
  }

  // Generate thermal printer formatted bill (before payment)
  generateThermalBill(billData) {
    console.log('🖨️ generateThermalBill called with data:', billData);
    
    // DEBUG: Check gstRate on items
    console.log('🖨️ Checking gstRate on bill items:');
    (billData.cartItems || []).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.name} - gstRate: ${item.gstRate || 'MISSING'}`);
    });
    
    // Aggregate duplicate items by name and price
    const aggregatedItems = billData.cartItems.reduce((acc, item) => {
      const existingItem = acc.find(i => i.name === item.name && i.price === item.price)
      if (existingItem) {
        existingItem.quantity += item.quantity
      } else {
        acc.push({ ...item })
      }
      return acc
    }, [])
    
    const lines = [];
    
    // Header - Hotel Info (CENTERED)
    lines.push(this.formatLine('JAGALI KOOTA', 'center'));
    lines.push(this.formatLine('MYSURU', 'center'));
    lines.push('');
    
    // Add watermark based on complimentary status
    if (billData.isComplimentary) {
      lines.push(this.formatLine('*** COMPLIMENTARY BILL ***', 'center'));
    } else {
      lines.push(this.formatLine('*** CASH BILL ***', 'center'));
    }
    lines.push('');
    
    // Service type and counter - Dynamic based on order type
    let serviceType = 'SELF SERVICE';
    console.log('🖨️ Thermal printer bill - determining service type:', {
      selectedTable: billData.selectedTable,
      tableNumber: billData.selectedTable?.tableNumber || billData.selectedTable?.number,
      selectedCategory: billData.selectedCategory,
      categoryName: billData.selectedCategory?.name,
      fullBillData: billData
    });
    
    if (billData.selectedTable && (billData.selectedTable.tableNumber || billData.selectedTable.number)) {
      serviceType = 'RESTAURANT';
      console.log('🖨️ Bill service type set to RESTAURANT (has table)');
    } else if (billData.selectedCategory) {
      const categoryName = billData.selectedCategory.name?.toLowerCase() || '';
      if (categoryName.includes('restaurant')) {
        serviceType = 'RESTAURANT';
        console.log('🖨️ Bill service type set to RESTAURANT (category)');
      } else if (categoryName.includes('temple') || categoryName.includes('meal')) {
        serviceType = 'TEMPLE MEALS';
        console.log('🖨️ Bill service type set to TEMPLE MEALS');
      } else if (categoryName.includes('darshini') || categoryName.includes('self service')) {
        serviceType = 'SELF SERVICE';
        console.log('🖨️ Bill service type set to SELF SERVICE');
      }
    }
    
    // Determine right corner text (table number only)
    const tableNumForBill = billData.selectedTable?.tableNumber || billData.selectedTable?.number;
    const billRightCorner = tableNumForBill ? `Table ${tableNumForBill}` : '';

    if (billRightCorner) {
      lines.push(this.formatTwoColumn('', billRightCorner));
    }
    lines.push(this.createSeparator('-'));
    
    // Date (right aligned) and Bill number (left aligned) - separate lines
    console.log('🖨️ Processing date and time:', {
      originalDate: billData.date,
      originalTime: billData.time,
      dateType: typeof billData.date,
      timeType: typeof billData.time
    });
    
    let formattedDate = 'NaN-NaN-NaN'; // Default fallback
    try {
      // Handle different date formats
      let dateObj;
      if (billData.date) {
        // Try parsing the date
        dateObj = new Date(billData.date);
        console.log('🖨️ Parsed date object:', dateObj, 'isValid:', !isNaN(dateObj.getTime()));
      } else {
        dateObj = new Date();
        console.log('🖨️ Using current date as fallback');
      }
      
      // Check if date is valid
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
        console.log('🖨️ Formatted date:', formattedDate);
      } else {
        // If billData.date is invalid, use current date
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
        console.log('🖨️ Using current date fallback:', formattedDate);
      }
    } catch (error) {
      console.error('🖨️ Date formatting error:', error);
      // Use current date as fallback
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
      console.log('🖨️ Error fallback date:', formattedDate);
    }
    
    // Format time
    let formattedTime = '';
    try {
      if (billData.time && typeof billData.time === 'string') {
        formattedTime = billData.time;
        console.log('🖨️ Using provided time:', formattedTime);
      } else {
        // Use current time
        formattedTime = new Date().toLocaleTimeString('en-IN', { 
          hour12: true, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        console.log('🖨️ Using current time:', formattedTime);
      }
    } catch (error) {
      console.error('🖨️ Time formatting error:', error);
      formattedTime = new Date().toLocaleTimeString('en-IN', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      console.log('🖨️ Error fallback time:', formattedTime);
    }
    
    console.log('🖨️ Final date and time for receipt:', { formattedDate, formattedTime });
    
    lines.push(this.formatTwoColumn(formattedDate, formattedTime));
    
    // Debug: Log what invoice number we're using
    console.log('🖨️ Thermal printer bill invoice number debug:', {
      billDataInvoiceNumber: billData.invoiceNumber,
      billDataBillNumber: billData.billNumber,
      fallbackValue: billData.invoiceNumber || '001',
      finalValue: String(billData.invoiceNumber || '001')
    });
    
    lines.push(this.leftMargin + 'BILL NO: ' + String(billData.invoiceNumber || '001'));
    
    // Add bill generation timestamp
    const billGenTime = new Date().toLocaleTimeString('en-IN', { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    lines.push(this.leftMargin + `Bill Generated: ${billGenTime}`);
    
    // Add KOT information for comprehensive bills - REMOVED per user request
    // Users don't want KOT information on receipts
    // if (billData.isComprehensiveBill && billData.kotNumbers && billData.kotNumbers.length > 1) {
    //   lines.push(this.leftMargin + 'KOTs: ' + billData.kotNumbers.join(', '));
    //   lines.push(this.leftMargin + '(' + billData.kotNumbers.length + ' KOTs combined)');
    // }
    
    lines.push(this.createSeparator('-'));
    
    // Items header - two column style
    lines.push(this.formatTwoColumn('ITEM NAME', 'QTY  RATE  AMOUNT'));
    lines.push(this.createSeparator('-'));
    
    // Items - use aggregated items
    aggregatedItems.forEach(item => {
      // Clean item name - remove leading numbers and spaces (001TEA -> TEA, 018 KESARI BATH -> KESARI BATH)
      let cleanItemName = item.name.replace(/^\d+\s*/, '').toUpperCase();
      const qty = parseFloat(item.quantity).toFixed(3);
      const rate = parseFloat(item.price).toFixed(2);
      const amount = parseFloat(item.price * item.quantity).toFixed(2);
      
      // Item name on one line
      lines.push(this.leftMargin + cleanItemName);
      
      // Quantity, rate, amount right-aligned on next line
      const qtyRateAmount = `${qty}  ${rate}  ${amount}`;
      lines.push(this.formatLine(qtyRateAmount, 'right'));
    });
    
    lines.push(this.createSeparator('-'));
    
    // Subtotal - use aggregated items
    const subtotal = aggregatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    lines.push(this.formatTwoColumn('SUBTOTAL:', `₹${parseFloat(subtotal).toFixed(2)}`));

    // GST Amount
    const totalGST = aggregatedItems.reduce((sum, item) => {
      const rate = item.gstRate || 0;
      const itemGST = ((item.price * item.quantity * rate) / 100);
      console.log(`🧾 BILL Item: ${item.name}, gstRate: ${rate}%, itemGST: ₹${itemGST.toFixed(2)}`);
      return sum + itemGST;
    }, 0);
    console.log(`🧾 BILL Total GST: ₹${totalGST.toFixed(2)}`);
    if (totalGST > 0) {
      lines.push(this.formatTwoColumn('GST AMOUNT:', `₹${parseFloat(totalGST).toFixed(2)}`));
    }
    
    // Discount (if applied)
    if (billData.discountAmount && billData.discountAmount > 0) {
      lines.push(this.formatTwoColumn('DISCOUNT:', `-₹${parseFloat(billData.discountAmount).toFixed(2)}`));
      
      // Show discount reason if available
      if (billData.discountRemark || billData.discount?.remark) {
        const remark = billData.discountRemark || billData.discount?.remark || '';
        if (remark.length > 0) {
          lines.push(this.leftMargin + `Reason: ${remark}`);
        }
      }
    }
    
    lines.push(this.createSeparator('-'));
    
    // GRAND TOTAL (subtotal + GST - discount)
    const total = subtotal + totalGST - (billData.discountAmount || 0);
    lines.push(this.formatTwoColumn('GRAND TOTAL:', `₹${parseFloat(total).toFixed(2)}`));
    lines.push(this.createSeparator('-'));
    
    // Footer - centered
    lines.push(this.formatLine('.. !! THANK YOU,VISIT AGAIN !!..', 'center'));
    
    // Remove invoice number at the end - users don't want duplicate
    // const finalInvoiceNumber = billData.invoiceNumber || billData.billNumber || '001';
    // lines.push(this.leftMargin + `Invoice No:${finalInvoiceNumber}`);
    
    // Paper cutting lines
    lines.push('');
    lines.push('');
    
    return lines.join('\n');
  }

  // Generate KOT (Kitchen Order Ticket) for kitchen
  generateKOT(kotData, isReprint = false) {
    const lines = [];
    
    // Header - KOT Title (LARGE, CENTERED)
    lines.push(this.formatLine('*** KITCHEN ORDER TICKET ***', 'center'));
    
    // Add REPRINT watermark if this is a reprint
    if (isReprint) {
      lines.push(this.formatLine('*** REPRINT ***', 'center'));
    }
    
    lines.push(this.createSeparator('='));
    lines.push('');
    
    // KOT Number and Table (LARGE)
    lines.push(this.formatLine(`KOT: ${kotData.kotNumber}`, 'center'));
    lines.push(this.formatLine(`TABLE: ${kotData.tableNumber}`, 'center'));
    lines.push('');
    lines.push(this.createSeparator('='));
    
    // Date and Time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN');
    const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });
    lines.push(this.formatTwoColumn('Date:', dateStr));
    lines.push(this.formatTwoColumn('Time:', timeStr));
    lines.push(this.createSeparator('-'));
    
    // Items header
    lines.push(this.formatTwoColumn('ITEM', 'QTY'));
    lines.push(this.createSeparator('='));
    
    // Items (LARGE FONT for kitchen)
    kotData.items.forEach(item => {
      const itemName = item.name.toUpperCase();
      const qty = `${item.quantity}x`;
      
      lines.push(this.formatTwoColumn(itemName, qty));
      
      // Add remark if present (Restaurant category only) - using 'remark' not 'remarks'
      if (item.remark && item.remark.trim()) {
        lines.push(this.formatLine(`  Note: ${item.remark}`, 'left'));
      }
      
      lines.push(''); // Extra space between items for readability
    });
    
    lines.push(this.createSeparator('='));
    
    // Total items
    const totalItems = kotData.items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(this.formatLine(`TOTAL ITEMS: ${totalItems}`, 'center'));
    
    // Footer
    lines.push('');
    lines.push(this.formatLine('*** PREPARE IMMEDIATELY ***', 'center'));
    
    // Paper cutting lines
    lines.push('');
    lines.push('');
    lines.push('');
    
    return lines.join('\n');
  }

  // Generate Updated KOT (Kitchen Order Ticket) for kitchen - shows changes
  generateUpdatedKOT(kotData) {
    const lines = [];
    
    // Header - Updated KOT Title (LARGE, CENTERED)
    lines.push(this.formatLine('*** UPDATED KITCHEN ORDER ***', 'center'));
    lines.push(this.formatLine('*** ORDER TICKET ***', 'center'));
    lines.push(this.createSeparator('='));
    lines.push('');
    
    // KOT Number and Table (LARGE) - Mark as UPDATED
    lines.push(this.formatLine(`KOT: ${kotData.kotNumber}`, 'center'));
    lines.push(this.formatLine(`TABLE: ${kotData.tableNumber}`, 'center'));
    lines.push(this.formatLine('*** UPDATED ORDER ***', 'center'));
    lines.push('');
    lines.push(this.createSeparator('='));
    
    // Date and Time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN');
    const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });
    lines.push(this.formatTwoColumn('Updated Date:', dateStr));
    lines.push(this.formatTwoColumn('Updated Time:', timeStr));
    lines.push(this.createSeparator('-'));
    
    // Important notice for kitchen
    lines.push(this.formatLine('*** REVISED QUANTITIES ***', 'center'));
    lines.push(this.formatLine('*** PLEASE UPDATE PREPARATION ***', 'center'));
    lines.push(this.createSeparator('-'));
    
    // Items header
    lines.push(this.formatTwoColumn('ITEM', 'NEW QTY'));
    lines.push(this.createSeparator('='));
    
    // Items (LARGE FONT for kitchen)
    kotData.items.forEach(item => {
      const itemName = item.name.toUpperCase();
      const qty = `${item.quantity}x`;
      
      lines.push(this.formatTwoColumn(itemName, qty));
      lines.push(''); // Extra space between items for readability
    });
    
    lines.push(this.createSeparator('='));
    
    // Total items
    const totalItems = kotData.items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(this.formatLine(`TOTAL ITEMS: ${totalItems}`, 'center'));
    
    // Footer with emphasis on changes
    lines.push('');
    lines.push(this.formatLine('*** ORDER MODIFIED ***', 'center'));
    lines.push(this.formatLine('*** PREPARE NEW QUANTITIES ***', 'center'));
    lines.push(this.formatLine('*** DISCARD PREVIOUS KOT ***', 'center'));
    
    // Paper cutting lines
    lines.push('');
    lines.push('');
    lines.push('');
    
    return lines.join('\n');
  }

  // Print via Electron (if available)
  async printViaElectron(receiptText) {
    if (!this.isElectron) {
      throw new Error('Electron API not available');
    }
    
    try {
      const result = await window.electronAPI.printThermal({
        text: receiptText,
        options: {
          preview: false,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: { width: 80, height: 200 } // 80mm thermal paper
        }
      });
      return result;
    } catch (error) {
      console.error('Electron thermal printing failed:', error);
      throw error;
    }
  }

  // Print via Web Serial API (for direct USB thermal printers)
  async printViaWebSerial(receiptText) {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported in this browser');
    }

    try {
      // Request port access with better error handling
      const port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x04b8 }, // Epson
          { usbVendorId: 0x0519 }, // Star
          { usbVendorId: 0x0fe6 }, // ICS Advent (Citizen)
        ]
      });
      
      await port.open({ baudRate: 9600 });

      // ESC/POS commands for thermal printer
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();

      // Initialize printer
      await writer.write(encoder.encode('\x1B\x40')); // ESC @ (Initialize)
      
      // Set left margin to 0 (no left margin)
      await writer.write(encoder.encode('\x1D\x4C\x00\x00')); // GS L 0 0 (Set left margin to 0)
      
      // Set font size and alignment
      await writer.write(encoder.encode('\x1B\x21\x00')); // Normal font
      await writer.write(encoder.encode('\x1B\x61\x00')); // Left align
      
      // Print receipt text
      await writer.write(encoder.encode(receiptText));
      
      // Cut paper
      await writer.write(encoder.encode('\x1D\x56\x42\x00')); // Partial cut
      
      // Feed paper
      await writer.write(encoder.encode('\n\n\n'));

      writer.releaseLock();
      await port.close();
      
      return { success: true, message: 'Receipt printed successfully via USB' };
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new Error('No thermal printer selected. Please connect a USB thermal printer and try again.');
      }
      console.error('Web Serial printing failed:', error);
      throw new Error(`USB printing failed: ${error.message}`);
    }
  }

  // Print via network (for network thermal printers)
  async printViaNetwork(receiptText, printerIP = '192.168.1.100', port = 9100) {
    try {
      // Use the backend URL from environment or default to localhost:9000
      const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel';
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${backendUrl}/print-thermal/network`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: receiptText,
          printerIP,
          port
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check content-type before parsing — a 404 HTML page would cause JSON parse error
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Thermal print endpoint not available (${response.status}). Using browser fallback.`);
      }

      const result = await response.json();

      if (!response.ok) {
        // Handle specific printer errors more gracefully
        if (result.error && (
          result.error.includes('timeout') || 
          result.error.includes('Connection timeout') ||
          result.error.includes('ECONNREFUSED') ||
          result.error.includes('EHOSTUNREACH')
        )) {
          throw new Error(`Thermal printer not found at ${printerIP}:${port}. Please check printer connection and IP address.`);
        }
        throw new Error(`Network printing failed: ${result.message || response.statusText}`);
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Network printing timed out. Printer at ${printerIP}:${port} is not responding.`);
      }
      console.error('Network thermal printing failed:', error);
      throw error;
    }
  }

  // Fallback to browser print with thermal-optimized CSS
  printViaBrowser(receiptText) {
    return new Promise((resolve) => {
      try {
        // Try to open popup window first
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        
        if (!printWindow) {
          // If popup is blocked, use safer current window method
          this.printInCurrentWindowSafe(receiptText);
          resolve({ success: true, method: 'current-window' });
          return;
        }

        const receiptHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Receipt</title>
            <style>
              @media print {
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 5mm;
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  line-height: 1.2;
                  width: 70mm;
                }
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.2;
                margin: 0;
                padding: 10px;
                width: 300px;
                background: white;
              }
              pre {
                margin: 0;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
            </style>
          </head>
          <body>
            <pre>${receiptText}</pre>
            <script>
              window.onload = function() {
                try {
                  window.print();
                  setTimeout(function() {
                    try {
                      window.close();
                    } catch(e) {
                      console.log('Could not close print window:', e);
                    }
                  }, 1000);
                } catch(e) {
                  console.log('Print failed:', e);
                  setTimeout(function() {
                    try {
                      window.close();
                    } catch(e2) {
                      console.log('Could not close window after print failure:', e2);
                    }
                  }, 500);
                }
              }
            </script>
          </body>
          </html>
        `;
        
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        
        // Don't wait for the print window - resolve immediately
        resolve({ success: true, method: 'popup-window' });
        
      } catch (error) {
        console.error('Browser print failed:', error);
        // Final fallback - safer current window method
        this.printInCurrentWindowSafe(receiptText);
        resolve({ success: true, method: 'current-window-fallback' });
      }
    });
  }

  // Safer print in current window method that doesn't block UI
  printInCurrentWindowSafe(receiptText) {
    try {
      // Create a temporary print area
      const printDiv = document.createElement('div');
      printDiv.id = 'thermal-print-temp-' + Date.now();
      printDiv.innerHTML = `
        <div style="display: none;">
          <style>
            @media print {
              body * { visibility: hidden; }
              #${printDiv.id}, #${printDiv.id} * { visibility: visible; }
              #${printDiv.id} {
                position: absolute;
                left: 0;
                top: 0;
                width: 80mm;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.2;
              }
            }
          </style>
          <pre>${receiptText}</pre>
        </div>
      `;
      
      document.body.appendChild(printDiv);
      
      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        try {
          window.print();
        } catch (printError) {
          console.error('Print dialog failed:', printError);
        }
        
        // Clean up after a delay
        setTimeout(() => {
          try {
            if (document.body.contains(printDiv)) {
              document.body.removeChild(printDiv);
            }
          } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError);
          }
        }, 2000);
      }, 100);
      
    } catch (error) {
      console.error('Safe print method failed:', error);
      // If all else fails, just log the receipt text
      console.log('Receipt content:', receiptText);
    }
  }

  // Main print method - tries different methods in order
  async printReceipt(paymentData, options = {}) {
    const receiptText = this.generateThermalReceipt(paymentData);
    return this.executePrintWithTimeout(receiptText, options);
  }

  // Print bill (before payment completion)
  async printBill(billData, options = {}) {
    const billText = this.generateThermalBill(billData);
    return this.executePrintWithTimeout(billText, options);
  }

  // Execute print with timeout to prevent hanging
  async executePrintWithTimeout(printText, options = {}, timeoutMs = 5000) {
    return Promise.race([
      this.executePrint(printText, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Print operation timed out')), timeoutMs)
      )
    ]).catch(error => {
      console.error('Print operation failed or timed out:', error);
      // Always fall back to safe browser print
      try {
        return this.printViaBrowser(printText);
      } catch (fallbackError) {
        console.error('Even browser fallback failed:', fallbackError);
        return { success: false, method: 'failed', error: error.message };
      }
    });
  }

  // Execute print with different methods
  async executePrint(printText, options = {}) {
    const { method = 'auto', printerIP, port } = options;

    console.log('Generated thermal print text:', printText);

    try {
      switch (method) {
        case 'electron':
          return await this.printViaElectron(printText);
        
        case 'serial':
          return await this.printViaWebSerial(printText);
        
        case 'network':
          try {
            return await this.printViaNetwork(printText, printerIP, port);
          } catch (e) {
            console.log('Network printing failed, falling back to browser:', e.message);
            return this.printViaBrowser(printText);
          }
        
        case 'browser':
          return this.printViaBrowser(printText);
        
        case 'auto':
        default:
          let lastError = null;
          
          // Try methods in order of preference
          if (this.isElectron) {
            try {
              return await this.printViaElectron(printText);
            } catch (e) {
              lastError = e;
              console.log('Electron printing failed, trying next method:', e.message);
            }
          }
          
          // Try network printing first (most reliable for thermal printers)
          if (printerIP && printerIP !== '192.168.1.100') { // Skip if using default IP
            try {
              return await this.printViaNetwork(printText, printerIP, port);
            } catch (e) {
              lastError = e;
              console.log('Network printing failed, trying next method:', e.message);
            }
          }
          
          // Try Web Serial API (Chrome/Edge only) - but don't auto-prompt user
          // This requires user interaction, so we'll skip it in auto mode
          // Users can explicitly choose 'serial' method if they want USB printing
          
          // Fallback to browser print (always works)
          console.log('Using browser print fallback');
          return this.printViaBrowser(printText);
      }
    } catch (error) {
      console.error('Print method failed:', error);
      // Final fallback to browser print
      console.log('All methods failed, using browser fallback');
      return this.printViaBrowser(printText);
    }
  }

  // Generate KOT Changes (Kitchen Order Ticket) for kitchen - shows only changes
  generateKOTChanges(kotData) {
    const lines = [];
    
    // Header - KOT Changes Title (LARGE, CENTERED)
    lines.push(this.formatLine('*** KOT CHANGES ***', 'center'));
    lines.push(this.formatLine('*** KITCHEN ORDER CHANGES ***', 'center'));
    lines.push(this.createSeparator('='));
    lines.push('');
    
    // KOT Number and Table (LARGE) - Mark as CHANGES
    lines.push(this.formatLine(`KOT: ${kotData.kotNumber}`, 'center'));
    lines.push(this.formatLine(`TABLE: ${kotData.tableNumber}`, 'center'));
    lines.push(this.formatLine('*** CHANGES ONLY ***', 'center'));
    lines.push('');
    lines.push(this.createSeparator('='));
    
    // Date and Time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN');
    const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });
    lines.push(this.formatTwoColumn('Change Date:', dateStr));
    lines.push(this.formatTwoColumn('Change Time:', timeStr));
    lines.push(this.createSeparator('-'));
    
    // Important notice for kitchen
    lines.push(this.formatLine('*** ITEM CHANGES ***', 'center'));
    lines.push(this.formatLine('*** ONLY PREPARE CHANGES ***', 'center'));
    lines.push(this.createSeparator('-'));
    
    // Items header
    lines.push(this.formatTwoColumn('ITEM CHANGES', 'OLD → NEW'));
    lines.push(this.createSeparator('='));
    
    // Items (LARGE FONT for kitchen) - show changes
    kotData.items.forEach(item => {
      const itemName = item.name.toUpperCase();
      console.log(`🖨️ Processing item for KOT changes:`, { 
        name: itemName, 
        quantity: item.quantity, 
        originalQuantity: item.originalQuantity,
        isRemoved: item.isRemoved, 
        isChanged: item.isChanged 
      })
      
      if (item.isRemoved) {
        console.log(`🖨️ Item marked as REMOVED: ${itemName}`)
        lines.push(this.formatTwoColumn(itemName, 'REMOVED'));
        lines.push(this.formatLine('*** CANCEL THIS ITEM ***', 'center'));
      } else if (item.isChanged) {
        console.log(`🖨️ Item marked as CHANGED: ${itemName}`)
        const changeText = `${item.originalQuantity}x → ${item.quantity}x`;
        lines.push(this.formatTwoColumn(itemName, changeText));
        
        // Show what to do
        if (item.quantity > item.originalQuantity) {
          const additional = item.quantity - item.originalQuantity;
          lines.push(this.formatLine(`*** PREPARE ${additional}x MORE ***`, 'center'));
        } else if (item.quantity < item.originalQuantity) {
          const reduce = item.originalQuantity - item.quantity;
          lines.push(this.formatLine(`*** REDUCE BY ${reduce}x ***`, 'center'));
        }
      } else {
        console.log(`🖨️ Item has no changes: ${itemName}`)
      }
      lines.push(''); // Extra space between items for readability
    });
    
    lines.push(this.createSeparator('='));
    
    // Summary of changes
    const removedItems = kotData.items.filter(item => item.isRemoved).length;
    const changedItems = kotData.items.filter(item => item.isChanged).length;
    
    if (removedItems > 0) {
      lines.push(this.formatLine(`REMOVED ITEMS: ${removedItems}`, 'center'));
    }
    if (changedItems > 0) {
      lines.push(this.formatLine(`CHANGED ITEMS: ${changedItems}`, 'center'));
    }
    
    // Footer with emphasis on changes
    lines.push('');
    lines.push(this.formatLine('*** PROCESS CHANGES ONLY ***', 'center'));
    lines.push(this.formatLine('*** DO NOT REMAKE ENTIRE ORDER ***', 'center'));
    
    // Paper cutting lines
    lines.push('');
    lines.push('');
    lines.push('');
    
    return lines.join('\n');
  }

  // Print KOT changes to kitchen printer
  async printKOTChanges(kotData, options = {}) {
    const kotText = this.generateKOTChanges(kotData);
    return this.executePrintWithTimeout(kotText, options);
  }

  // Print KOT to kitchen printer
  async printKOT(kotData, options = {}) {
    const isReprint = options.isReprint || false;
    const kotText = this.generateKOT(kotData, isReprint);
    return this.executePrintWithTimeout(kotText, options);
  }
}
export default new ThermalPrinterService();