// ═══ دفتر المقهى ═══ 08-checkout.js — الطاولات، إضافة أصناف، إغلاق الفاتورة، حسابات المشتريات
// (مقسوم من app.js — الأسطر 4112-4539)

function selectTable(tableId) {
  const nextTable = Math.min(Math.max(Number(tableId), 1), getTableCount());
  state.selectedTable = nextTable;
  getOpenOrder();
  renderPosOnly();
  confirmTableSwitch(nextTable);
}

function confirmTableSwitch(tableId) {
  const tableLabel = getTableLabel(tableId);
  els.tablesGrid.querySelectorAll(".is-switch-confirmed").forEach((button) => button.classList.remove("is-switch-confirmed"));
  const selectedButton = els.tablesGrid.querySelector(`[data-table="${tableId}"]`);
  selectedButton?.classList.add("is-switch-confirmed");

  if (els.orderPanel) {
    els.orderPanel.classList.remove("is-table-switching");
    void els.orderPanel.offsetWidth;
    els.orderPanel.classList.add("is-table-switching");
  }

  if (els.orderSubtitle) {
    els.orderSubtitle.textContent = `تم الانتقال إلى ${tableLabel}`;
  }

  clearTimeout(confirmTableSwitch.timer);
  confirmTableSwitch.timer = setTimeout(() => {
    selectedButton?.classList.remove("is-switch-confirmed");
    els.orderPanel?.classList.remove("is-table-switching");
    if (Number(state.selectedTable) === Number(tableId) && els.orderSubtitle) {
      els.orderSubtitle.textContent = `رقم الطاولة ${state.selectedTable}`;
    }
  }, 950);
}

function addTable() {
  state.tableCount = getTableCount() + 1;
  state.selectedTable = state.tableCount;
  getOpenOrder();
  showToast("تمت إضافة طاولة جديدة.");
  render();
}

async function deleteSelectedTable() {
  const tableCount = getTableCount();
  const tableId = state.selectedTable;
  const order = getExistingOrder(tableId);

  if (tableCount <= 1) {
    showToast("لا يمكن حذف آخر طاولة.");
    return;
  }

  if (order?.items.length) {
    showToast("على الطاولة طلب مفتوح. أغلقه أو فرغه قبل الحذف.");
    return;
  }

  const confirmed = await appConfirm(`حذف الطاولة "${getTableLabel(tableId)}"؟`);
  if (!confirmed) return;

  const shiftedOrders = {};
  Object.entries(state.openOrders).forEach(([key, tableOrder]) => {
    const currentId = Number(key);
    if (!Number.isFinite(currentId) || currentId === tableId) return;
    const nextId = currentId > tableId ? currentId - 1 : currentId;
    shiftedOrders[String(nextId)] = { ...tableOrder, tableId: nextId };
  });

  const shiftedNames = {};
  Object.entries(state.tableNames || {}).forEach(([key, name]) => {
    const currentId = Number(key);
    if (!Number.isFinite(currentId) || currentId === tableId) return;
    const nextId = currentId > tableId ? currentId - 1 : currentId;
    shiftedNames[String(nextId)] = name;
  });

  state.openOrders = shiftedOrders;
  state.tableNames = shiftedNames;
  state.tableCount = tableCount - 1;
  state.selectedTable = Math.min(tableId, state.tableCount);
  getOpenOrder();
  showToast("تم حذف الطاولة المحددة.");
  render();
}

function closeItemOptionPicker() {
  const picker = typeof document.getElementById === "function"
    ? document.getElementById("optionPickerPopover")
    : null;
  if (optionPickerCleanup) {
    optionPickerCleanup();
    optionPickerCleanup = null;
  }
  if (picker) picker.remove();
  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll(".menu-item.is-options-open").forEach((item) => {
      item.classList.remove("is-options-open");
      item.setAttribute("aria-expanded", "false");
    });
  }
}

function hasPreferredMenuOption(itemId) {
  return Object.prototype.hasOwnProperty.call(preferredMenuOptionByItemId, itemId);
}

function getPreferredMenuOptionId(item) {
  if (!item || !hasPreferredMenuOption(item.id)) return undefined;
  const optionId = preferredMenuOptionByItemId[item.id] || "";
  if (optionId && (!Array.isArray(item.options) || !item.options.some((option) => option.id === optionId))) {
    delete preferredMenuOptionByItemId[item.id];
    return undefined;
  }
  return optionId;
}

function rememberPreferredMenuOption(itemId, optionId) {
  preferredMenuOptionByItemId[itemId] = optionId || "";
}

function addMenuItemFromGrid(itemId, optionId, sourceEl, forcePicker = false) {
  const item = state.menu.find((menuItem) => menuItem.id === itemId);
  if (!item) return;
  if (Array.isArray(item.options) && item.options.length && optionId === undefined) {
    const preferredOptionId = getPreferredMenuOptionId(item);
    if (!forcePicker && preferredOptionId !== undefined) {
      expandedMenuOptionsItemId = "";
      closeItemOptionPicker();
      addItem(item.id, preferredOptionId || null);
      return;
    }
    expandedMenuOptionsItemId = item.id;
    openItemOptionPicker(item, sourceEl);
    return;
  }
  if (Array.isArray(item.options) && item.options.length) rememberPreferredMenuOption(item.id, optionId || "");
  expandedMenuOptionsItemId = "";
  closeItemOptionPicker();
  addItem(itemId, optionId || null);
}

function openItemOptionPicker(item, anchorEl) {
  const anchor = anchorEl instanceof HTMLElement ? anchorEl : null;
  const existing = document.getElementById("optionPickerPopover");
  if (existing && existing.dataset.itemId === item.id) {
    expandedMenuOptionsItemId = "";
    closeItemOptionPicker();
    return;
  }

  closeItemOptionPicker();
  const order = getOpenOrder();
  const customPrice = getCustomerItemPrice(order.customerId, item.id);
  const basePrice = customPrice !== null ? customPrice : Number(item.price);
  const picker = document.createElement("div");
  picker.id = "optionPickerPopover";
  picker.className = "option-picker-popover";
  picker.dataset.itemId = item.id;
  picker.setAttribute("role", "menu");
  picker.setAttribute("aria-label", `أحجام ${item.name}`);
  picker.innerHTML = `
    <button class="option-pick-btn is-default" type="button" role="menuitem" data-opt="">عادي<span>${money(basePrice)}</span></button>
    ${item.options.map((opt) => `<button class="option-pick-btn" type="button" role="menuitem" data-opt="${escapeAttr(opt.id)}">${escapeHtml(opt.label)}<span>${money(opt.price)}</span></button>`).join("")}
  `;

  document.body.appendChild(picker);
  if (anchor) {
    anchor.classList.add("is-options-open");
    anchor.setAttribute("aria-expanded", "true");
  }

  const placePicker = () => {
    const rect = anchor ? anchor.getBoundingClientRect() : { left: 12, right: 12, top: 12, bottom: 12, width: 160 };
    const maxWidth = Math.max(180, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width * 1.7, 190), 280, maxWidth);
    picker.style.width = `${width}px`;

    const height = picker.offsetHeight;
    let left = rect.left + (rect.width / 2) - (width / 2);
    let top = rect.bottom + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    if (top + height > window.innerHeight - 8) top = rect.top - height - 6;
    picker.style.left = `${left}px`;
    picker.style.top = `${Math.max(8, top)}px`;
  };

  const onOutsideClick = (event) => {
    if (picker.contains(event.target) || (anchor && anchor.contains(event.target))) return;
    expandedMenuOptionsItemId = "";
    closeItemOptionPicker();
  };
  const onKeydown = (event) => {
    if (event.key !== "Escape") return;
    expandedMenuOptionsItemId = "";
    closeItemOptionPicker();
  };

  picker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-opt]");
    if (!button) return;
    event.stopPropagation();
    expandedMenuOptionsItemId = "";
    rememberPreferredMenuOption(item.id, button.dataset.opt || "");
    addItem(item.id, button.dataset.opt || null);
    closeItemOptionPicker();
  });

  optionPickerCleanup = () => {
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", placePicker);
    window.removeEventListener("scroll", placePicker, true);
    if (anchor) {
      anchor.classList.remove("is-options-open");
      anchor.setAttribute("aria-expanded", "false");
    }
  };

  requestAnimationFrame(placePicker);
  setTimeout(() => document.addEventListener("click", onOutsideClick), 0);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", placePicker);
  window.addEventListener("scroll", placePicker, true);
}

function addItem(itemId, optionId) {
  const item = state.menu.find((menuItem) => menuItem.id === itemId);
  if (!item) return;
  const order = getOpenOrder();

  // إضافة سطر بخيار (حجم/إضافة): سطر عادي باسم وسعر و id فريد، يحمل تكلفة ومخزون الصنف الأساسي.
  const option = optionId && Array.isArray(item.options) ? item.options.find((o) => o.id === optionId) : null;
  if (option) {
    const lineId = `${item.id}__${option.id}`;
    const optionPrice = Number(option.price);
    const existingOption = order.items.find((line) => line.id === lineId);
    if (existingOption) {
      existingOption.qty += 1;
      existingOption.price = optionPrice;
    } else {
      order.items.push({
        id: lineId,
        name: `${item.name} - ${option.label}`,
        price: optionPrice,
        cost: menuItemRecipeCost(item),
        qty: 1,
        stockUsage: stockUsageFromMenuItem(item),
        isCustomPrice: false
      });
    }
    render();
    return;
  }

  const customPrice = getCustomerItemPrice(order.customerId, item.id);
  const price = customPrice !== null ? customPrice : Number(item.price);
  const existing = order.items.find((line) => line.id === item.id);
  if (existing) {
    existing.qty += 1;
    // حدّث السعر لو تغير (مثلاً تغير العميل)
    existing.price = price;
    existing.isCustomPrice = customPrice !== null;
  } else {
    order.items.push({
      id: item.id,
      name: item.name,
      price,
      cost: menuItemRecipeCost(item),
      qty: 1,
      stockUsage: stockUsageFromMenuItem(item),
      isCustomPrice: customPrice !== null
    });
  }
  render();
}

function addCustomItem(event) {
  event.preventDefault();
  const name = els.customItemNameInput.value.trim();
  const price = Number(els.customItemPriceInput.value || 0);

  if (!name || price <= 0) {
    showToast("اكتب اسم الصنف المؤقت وسعره.");
    return;
  }

  const order = getOpenOrder();
  order.items.push({
    id: uid("custom-item"),
    name,
    price,
    cost: 0,
    qty: 1,
    temporary: true
  });

  els.customItemForm.reset();
  showToast("تمت إضافة الصنف للطلب فقط.");
  render();
}

// حاسبة تقسيم الفاتورة (عرض فقط — لا تعدّل الطلب ولا الفواتير)
function openSplitBill() {
  const order = getOpenOrder();
  const math = orderMath(order);
  const total = Number(math.total || 0);
  if (total <= 0) { showToast("الطلب فارغ — أضف أصناف أولاً."); return; }

  const existing = document.getElementById("splitBillOverlay");
  if (existing) existing.remove();
  let people = 2;

  const overlay = document.createElement("div");
  overlay.id = "splitBillOverlay";
  overlay.className = "option-picker-overlay";
  overlay.innerHTML = `
    <div class="option-picker-box split-bill-box">
      <div class="option-picker-head">
        <strong>🧮 تقسيم الفاتورة</strong>
        <button class="option-picker-close" type="button" aria-label="إغلاق">✕</button>
      </div>
      <p id="splitTotalNote"></p>
      <div class="split-people-row">
        <span>عدد الأشخاص</span>
        <div class="split-stepper">
          <button type="button" data-split-dec aria-label="إنقاص">−</button>
          <output id="splitPeopleValue">2</output>
          <button type="button" data-split-inc aria-label="زيادة">+</button>
        </div>
      </div>
      <div class="split-share">
        <span>حصة كل شخص</span>
        <strong id="splitShareValue"></strong>
      </div>
      <button class="primary-button wide" type="button" data-split-fill>💵 تعبئة حصة شخص في خانة الدفع</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const update = () => {
    const share = Math.round((total / people) * 100) / 100;
    overlay.querySelector("#splitShareValue").textContent = money(share);
    overlay.querySelector("#splitPeopleValue").textContent = String(people);
    overlay.querySelector("#splitTotalNote").textContent = `الإجمالي ${money(total)} ÷ ${people} أشخاص`;
    return share;
  };
  update();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".option-picker-close")) { overlay.remove(); return; }
    if (event.target.closest("[data-split-dec]")) { people = Math.max(2, people - 1); update(); return; }
    if (event.target.closest("[data-split-inc]")) { people = Math.min(50, people + 1); update(); return; }
    if (event.target.closest("[data-split-fill]")) {
      const share = update();
      if (els.paymentAmountInput) {
        els.paymentAmountInput.value = inputNumberValue(share);
        els.paymentAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      overlay.remove();
      showToast(`حصة الشخص ${money(share)} — حصّلها وأغلق، وكرّر للباقي.`);
    }
  });
}

function updateLine(itemId, action) {
  const order = getOpenOrder();
  const line = order.items.find((item) => item.id === itemId);
  if (!line) return;

  if (action === "inc") line.qty += 1;
  if (action === "dec") line.qty -= 1;
  if (action === "remove" || line.qty <= 0) {
    order.items = order.items.filter((item) => item.id !== itemId);
  }
  render();
}

function syncOrderFields() {
  const order = getOpenOrder();
  order.customerName = els.customerNameInput.value.trim();
  order.customerPhone = els.customerPhoneInput.value.trim();
  order.customerId = els.customerSelect.value || null;
  order.discount = Math.max(Number(els.discountInput.value || 0), 0);
  order.paymentMethod = paymentMethods.includes(els.paymentMethodInput.value) ? els.paymentMethodInput.value : getLastPaymentMethod();
  setLastPaymentMethod(order.paymentMethod);
  order.payments = { cash: 0, bank: 0, wallet: 0 };
  order.payments[order.paymentMethod] = Math.max(Number(els.paymentAmountInput.value || 0), 0);
  order.changeReturned = Math.max(Number(els.changeReturnedInput?.value || 0), 0);
  order.note = els.noteInput.value.trim();
}

function syncCustomerFromNameInput() {
  const order = getOpenOrder();
  const typedName = els.customerNameInput.value.trim();
  const selectedCustomer = getCustomer(order.customerId);
  const matchedCustomer = findCustomerByName(typedName);

  if (!typedName) {
    order.customerId = null;
    order.customerName = "";
    order.customerPhone = "";
    els.customerSelect.value = "";
    els.customerPhoneInput.value = "";
    return;
  }

  if (matchedCustomer) {
    order.customerId = matchedCustomer.id;
    order.customerName = matchedCustomer.name;
    order.customerPhone = matchedCustomer.phone || "";
    els.customerSelect.value = matchedCustomer.id;
    els.customerPhoneInput.value = matchedCustomer.phone || "";
    selectedCustomerId = matchedCustomer.id;
    return;
  }

  if (selectedCustomer && selectedCustomer.name.trim() !== typedName) {
    order.customerId = null;
    order.customerPhone = "";
    els.customerSelect.value = "";
    els.customerPhoneInput.value = "";
  }

  order.customerName = typedName;
}

function quickPayFillFull() {
  syncOrderFields();
  const order = getOpenOrder();
  if (!order.items.length) {
    showToast("أضف أصناف للطلب أولاً.");
    return;
  }
  const math = orderMath(order);
  els.paymentAmountInput.value = inputNumberValue(math.total);
  if (els.changeReturnedInput) els.changeReturnedInput.value = "";
  syncOrderFields();
  renderOrderTotals();
  saveState();
}

async function closeInvoice() {
  syncOrderFields();
  const order = getOpenOrder();
  const math = orderMath(order);
  const rawPaid = paymentTotal(order.payments);
  if (Number(order.changeReturned || 0) > rawPaid + 0.001) {
    showToast("الراجع للعميل أكبر من المبلغ المدفوع.");
    els.changeReturnedInput?.focus();
    renderOrderTotals(order);
    return;
  }

  if (!order.items.length && !math.manualDebt) {
    if (paymentTotal(order.payments) > 0 && !order.customerId && !order.customerName.trim()) {
      showToast("سجل اسم العميل حتى تحفظ المبلغ كدين بدون أصناف.");
      els.customerNameInput.focus();
      renderOrderTotals(order);
      return;
    }
    showToast("أضف صنف أو سجل اسم العميل ومبلغ الدين.");
    return;
  }

  if (math.delta < -0.001 && !order.customerId && !order.customerName.trim()) {
    showToast("الدفع أكثر من المطلوب. سجل اسم العميل حتى تنحفظ الزيادة كرصيد.");
    els.customerNameInput.focus();
    renderOrderTotals(order);
    return;
  }

  if (math.profit < -0.001) {
    const confirmed = await appConfirm(`البيع مخسر بقيمة ${money(Math.abs(math.profit))}. هل تريد إغلاق الفاتورة؟`);
    if (!confirmed) return;
  }

  let customer = order.customerId ? getCustomer(order.customerId) : null;
  if (!customer && order.customerName) {
    customer = upsertCustomer(order.customerName, { phone: order.customerPhone });
    order.customerId = customer.id;
  } else if (customer && order.customerPhone) {
    customer.phone = order.customerPhone;
    customer.updatedAt = new Date().toISOString();
  }

  const status = invoiceStatus(math.delta);
  const number = nextInvoiceNumber();
  const invoicePayments = math.manualDebt
    ? { cash: 0, bank: 0, wallet: 0 }
    : paymentsAfterChangeReturned(order.payments, math.changeReturned, order.paymentMethod);
  const invoice = {
    id: uid("invoice"),
    number,
    type: "sale",
    tableId: order.tableId,
    tableLabel: getTableLabel(order.tableId),
    customerId: customer?.id || null,
    customerName: customer?.name || order.customerName || "زبون نقدي",
    items: order.items.map((item) => ({ ...item })),
    subtotal: math.subtotal,
    discount: math.discount,
    total: math.total,
    paid: math.paid,
    received: math.manualDebt ? 0 : math.rawPaid,
    changeReturned: math.manualDebt ? 0 : math.changeReturned,
    delta: math.delta,
    payments: invoicePayments,
    status,
    note: math.manualDebt ? order.note || "دين بدون أصناف" : order.note,
    createdAt: new Date().toISOString()
  };

  if (customer) {
    customer.totalBilled += math.total;
    customer.totalPaid += math.paid;
    customer.balance += math.delta;
    customer.updatedAt = new Date().toISOString();
  } else if (math.delta > 0) {
    showToast("الفاتورة فيها دين. احفظ اسم العميل حتى يظهر الدين على حسابه.");
    return;
  }

  reduceStockForSoldItems(invoice.items);
  state.invoices.unshift(invoice);
  lastClosedInvoice = invoice;
  delete state.openOrders[String(order.tableId)];
  getOpenOrder(order.tableId);
  showToast(`تم إغلاق الفاتورة ${number}`);
  render();
}

function nextInvoiceNumber() {
  const next = state.invoices.reduce((max, invoice) => {
    const numeric = Number(String(invoice.number || "").replace(/\D/g, ""));
    return Math.max(max, numeric || 0);
  }, 0) + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

function nextPurchaseNumber() {
  const next = state.purchases.reduce((max, purchase) => {
    const numeric = Number(String(purchase.number || "").replace(/\D/g, ""));
    return Math.max(max, numeric || 0);
  }, 0) + 1;
  return `PINV-${String(next).padStart(4, "0")}`;
}

function purchaseLines(purchase) {
  if (Array.isArray(purchase.items) && purchase.items.length) {
    return purchase.items.map((line) => {
      const qty = Number(line.qty || 0);
      const unit = normalizeUnit(line.unit || itemUnit(findMenuItem(line.menuItemId)));
      const stockPerUnit = Number(line.stockPerUnit ?? line.stockUnitsPerPurchase ?? line.unitsPerPurchase ?? 0);
      const stockQty = Number(line.stockQty ?? line.inventoryQty ?? line.outputQty ?? (stockPerUnit > 0 ? qty * stockPerUnit : qty));
      const stockUnit = normalizeUnit(line.stockUnit || line.inventoryUnit || line.outputUnit || unit);
      const amount = Number(line.amount || 0);
      return {
        ...line,
        qty,
        unit,
        stockPerUnit: stockPerUnit > 0 ? stockPerUnit : (qty > 0 && stockQty > 0 ? stockQty / qty : 0),
        stockQty,
        stockUnit,
        unitCost: Number(line.unitCost ?? line.stockUnitCost ?? (stockQty ? amount / stockQty : 0))
      };
    });
  }
  const qty = Number(purchase.qty || 0);
  const unit = normalizeUnit(purchase.unit || itemUnit(findMenuItem(purchase.menuItemId)));
  const stockPerUnit = Number(purchase.stockPerUnit ?? purchase.stockUnitsPerPurchase ?? purchase.unitsPerPurchase ?? 0);
  const stockQty = Number(purchase.stockQty ?? purchase.inventoryQty ?? purchase.outputQty ?? (stockPerUnit > 0 ? qty * stockPerUnit : qty));
  const stockUnit = normalizeUnit(purchase.stockUnit || purchase.inventoryUnit || purchase.outputUnit || unit);
  const amount = Number(purchase.amount || 0);
  return [{
    id: purchase.id,
    menuItemId: purchase.menuItemId || null,
    item: purchase.item || "مشتريات",
    linkedItemName: purchase.linkedItemName || "",
    qty,
    unit,
    stockPerUnit: stockPerUnit > 0 ? stockPerUnit : (qty > 0 && stockQty > 0 ? stockQty / qty : 0),
    stockQty,
    stockUnit,
    amount,
    unitCost: Number(purchase.unitCost ?? purchase.stockUnitCost ?? (stockQty ? amount / stockQty : 0)),
    stockAfter: purchase.stockAfter ?? null
  }];
}

function purchaseAmount(purchase) {
  if (purchase.amount !== undefined) return Number(purchase.amount || 0);
  return purchaseLines(purchase).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function purchaseLinesAmount(lines = []) {
  return lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function purchaseLineMatchesSearch(line, query) {
  if (!query) return true;
  const haystack = `${line.item || ""} ${purchaseLinkedItemName(line)} ${line.qty || ""} ${line.unit || ""} ${purchaseLineStockQty(line)} ${purchaseLineStockUnit(line)} ${line.amount || ""} ${purchaseLineUnitCost(line)}`;
  return searchMatch(haystack, query);
}

function purchaseSearchInfo(purchase, query) {
  const lines = purchaseLines(purchase);
  const purchaseHaystack = `${purchase.number || ""} ${purchase.item || ""} ${purchase.supplier || ""} ${purchase.note || ""}`;
  const purchaseMatches = searchMatch(purchaseHaystack, query);
  const matchingLines = lines.filter((line) => purchaseLineMatchesSearch(line, query));

  return {
    purchase,
    lines,
    matches: purchaseMatches || matchingLines.length > 0,
    statLines: purchaseMatches ? lines : matchingLines
  };
}

function menuItemsFromPurchaseLines(lines = []) {
  if (!ENABLE_LINKING) return [];
  const ids = [...new Set(lines.map((line) => line.menuItemId).filter(Boolean))];
  return ids.map((id) => findMenuItem(id)).filter(Boolean);
}

function purchaseLineSalesStats(line) {
  if (!ENABLE_LINKING) return null;
  const menuItem = line.menuItemId ? findMenuItem(line.menuItemId) : null;
  if (!menuItem) return null;
  return {
    item: menuItem,
    stats: menuItemProfitStats(menuItem.id)
  };
}

function purchaseLinkedItem(line) {
  if (!ENABLE_LINKING) return null;
  return line.menuItemId ? findMenuItem(line.menuItemId) : null;
}

function purchaseLinkedItemName(line) {
  if (!ENABLE_LINKING) return "";
  return purchaseLinkedItem(line)?.name || line.linkedItemName || "";
}

function purchaseLinkedItemText(line) {
  if (!ENABLE_LINKING) return "";
  const linkedName = purchaseLinkedItemName(line);
  return linkedName ? `مرتبط بالصنف: ${escapeHtml(linkedName)}` : "بدون ربط";
}

function purchaseLineStockBadges(line) {
  if (!ENABLE_LINKING) return "";
  const menuItem = line.menuItemId ? findMenuItem(line.menuItemId) : findMenuItemByName(line.item || "");
  if (!menuItem) return '<span>المخزون الحالي: بدون ربط</span>';

  const unit = normalizeUnit(line.unit || itemUnit(menuItem));
  const currentStock = isStockTracked(menuItem) ? quantityWithUnit(menuItem.stockQty, unit) : "غير متتبع";
  const stockAfter = line.stockAfter !== null && line.stockAfter !== undefined
    ? `<span>المخزون بعد الفاتورة: ${quantityWithUnit(line.stockAfter, unit)}</span>`
    : "";

  return `
    <span class="purchase-stock-badge">المخزون الحالي: ${currentStock}</span>
    ${stockAfter}
  `;
}

function purchaseSearchSalesStats(matches = []) {
  const statLines = matches.flatMap((match) => match.statLines);
  if (!ENABLE_LINKING) {
    return {
      itemCount: statLines.length,
      linkedItemCount: 0,
      purchaseQty: statLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
      stockQty: statLines.reduce((sum, line) => sum + purchaseLineStockQty(line), 0),
      salePriceText: "-",
      qty: 0,
      sales: 0,
      profit: 0
    };
  }
  const menuItems = menuItemsFromPurchaseLines(statLines);
  const salesTotals = menuItems.reduce((totals, item) => {
    const stats = menuItemProfitStats(item.id);
    totals.qty += stats.qty;
    totals.sales += stats.sales;
    totals.profit += stats.profit;
    return totals;
  }, { qty: 0, sales: 0, profit: 0 });

  return {
    itemCount: statLines.length,
    linkedItemCount: menuItems.length,
    purchaseQty: statLines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    stockQty: statLines.reduce((sum, line) => sum + purchaseLineStockQty(line), 0),
    salePriceText: salePriceSummary(menuItems),
    ...salesTotals
  };
}
