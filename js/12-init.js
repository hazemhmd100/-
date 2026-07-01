// ═══ دفتر المقهى ═══ 12-init.js — ربط الأحداث وتشغيل التطبيق
// (مقسوم من app.js — الأسطر 5519-5929)

function wireEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  // الشاشة الرئيسية: أزرار وبطاقات الانتقال السريع
  const dashboardContent = document.getElementById("dashboardContent");
  if (dashboardContent) {
    dashboardContent.addEventListener("click", (event) => {
      const goButton = event.target.closest("[data-go-view]");
      if (goButton) switchView(goButton.dataset.goView);
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("button, [role='button'], .customer-card, .ledger-row, .settings-row, .purchase-line-card, .invoice-card, .cashbox-action-card");
    if (!target || target.matches("button:disabled, [aria-disabled='true']")) return;
    target.classList.add("is-pressed");
    window.setTimeout(() => target.classList.remove("is-pressed"), 220);
  });

  els.tablesGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-table]");
    if (button) selectTable(button.dataset.table);
  });

  const tableSearchInput = document.getElementById("tableSearchInput");
  if (tableSearchInput) tableSearchInput.addEventListener("input", renderTables);

  els.newOrderButton.addEventListener("click", () => {
    state.openOrders[String(state.selectedTable)] = {
      id: uid("order"),
      tableId: state.selectedTable,
      customerId: null,
      customerName: "",
      customerPhone: "",
      items: [],
      discount: 0,
      paymentMethod: getLastPaymentMethod(),
      payments: { cash: 0, bank: 0, wallet: 0 },
      changeReturned: 0,
      note: "",
      createdAt: new Date().toISOString()
    };
    render();
  });

  els.addTableButton.addEventListener("click", addTable);
  if (els.tableMergeButton) els.tableMergeButton.addEventListener("click", openTableMergePicker);
  els.deleteTableButton.addEventListener("click", deleteSelectedTable);

  els.tableNameInput.addEventListener("input", () => {
    setTableLabel(state.selectedTable, els.tableNameInput.value);
    renderTables();
    saveState();
  });

  els.customerSelect.addEventListener("change", () => {
    const order = getOpenOrder();
    const customer = getCustomer(els.customerSelect.value);
    if (!customer) {
      order.customerId = null;
      order.customerName = "";
      order.customerPhone = "";
      els.customerNameInput.value = "";
      els.customerPhoneInput.value = "";
    } else {
      order.customerId = customer.id;
      order.customerName = customer.name;
      order.customerPhone = customer.phone || "";
      selectedCustomerId = customer.id;
    }
    render();
  });

  els.customerSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggest-customer]");
    if (button) chooseSuggestedCustomer(button.dataset.suggestCustomer);
  });

  els.saveCustomerButton.addEventListener("click", () => {
    const customer = upsertCustomer(els.customerNameInput.value, { phone: els.customerPhoneInput.value.trim() });
    if (!customer) {
      showToast("اكتب اسم العميل أولاً.");
      return;
    }
    const order = getOpenOrder();
    order.customerId = customer.id;
    order.customerName = customer.name;
    order.customerPhone = customer.phone || "";
    selectedCustomerId = customer.id;
  showToast("تم حفظ العميل في الطلب.");
    render();
  });
  if (els.posCustomerAccountCard) {
    els.posCustomerAccountCard.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pos-customer-action]");
      if (!button) return;
      if (button.dataset.posCustomerAction === "settle") {
        settlePosCustomerAccount(button.dataset.posCustomer);
      } else {
        openPosCustomerAccount(button.dataset.posCustomer);
      }
    });
  }

  window.addEventListener("beforeunload", () => saveState(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState(true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (els.customerReminderModal && !els.customerReminderModal.hidden) {
      closeBulkDebtReminders();
      return;
    }
    if (els.customerEditModal && !els.customerEditModal.hidden) {
      closeCustomerEditCard();
    }
  });

  els.menuCategories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category;
    renderMenu();
  });

  if (els.quickMenuItems) {
    els.quickMenuItems.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quick-menu-item]");
      if (!button) return;
      addQuickSaleItem(button.dataset.quickMenuItem, button);
    });

    els.quickMenuItems.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const button = event.target.closest("[data-quick-menu-item]");
      if (!button) return;
      event.preventDefault();
      addQuickSaleItem(button.dataset.quickMenuItem, button);
    });
  }

  els.menuGrid.addEventListener("click", (event) => {
    const comboCard = event.target.closest("[data-combo-id]");
    if (comboCard) {
      addComboToOrder(comboCard.dataset.comboId);
      return;
    }

    const sizePickerButton = event.target.closest("[data-menu-size-picker]");
    if (sizePickerButton) {
      event.stopPropagation();
      const item = sizePickerButton.closest("[data-menu-item]");
      addMenuItemFromGrid(sizePickerButton.dataset.menuSizePicker, undefined, item, true);
      return;
    }

    const optionButton = event.target.closest("[data-menu-option]");
    if (optionButton) {
      event.stopPropagation();
      addMenuItemFromGrid(optionButton.dataset.menuItem, optionButton.dataset.menuOption || null);
      return;
    }

    const button = event.target.closest("[data-menu-item]");
    if (button) addMenuItemFromGrid(button.dataset.menuItem, undefined, button);
  });

  els.menuGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-menu-item]");
    if (!item || event.target.closest("[data-menu-option]")) return;
    event.preventDefault();
    if (event.target.closest("[data-menu-size-picker]")) {
      addMenuItemFromGrid(item.dataset.menuItem, undefined, item, true);
      return;
    }
    addMenuItemFromGrid(item.dataset.menuItem, undefined, item);
  });

  els.orderItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-line-action]");
    if (button) updateLine(button.dataset.item, button.dataset.lineAction);
  });

  els.clearOrderButton.addEventListener("click", () => {
    const order = getOpenOrder();
    order.items = [];
    order.discount = 0;
    order.payments = { cash: 0, bank: 0, wallet: 0 };
    order.changeReturned = 0;
    order.note = "";
    render();
  });

  const previewOrderChange = () => {
    syncOrderFields();
    renderStats();
    renderTables();
    renderOrderTotals();
    saveState();
  };

  els.customerNameInput.addEventListener("input", () => {
    syncCustomerFromNameInput();
    renderCustomerSuggestions();
    previewOrderChange();
  });

  els.customerNameInput.addEventListener("focus", renderCustomerSuggestions);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#customerNameInput") && !event.target.closest("#customerSuggestions")) {
      els.customerSuggestions.classList.remove("is-visible");
    }
  });

  [els.customerPhoneInput, els.discountInput, els.paymentAmountInput, els.changeReturnedInput, els.noteInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", previewOrderChange);
  });
  els.paymentMethodInput.addEventListener("change", previewOrderChange);
  els.settlementMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.settlementMethodInput.value);
    saveState();
  });
  els.purchaseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.purchaseMethodInput.value);
    saveState();
  });

  els.menuSearchInput.addEventListener("input", renderMenu);
  els.menuSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const firstItem = els.menuGrid.querySelector("[data-menu-item]");
    if (!firstItem) return;
    event.preventDefault();
    addMenuItemFromGrid(firstItem.dataset.menuItem, undefined, firstItem);
  });
  document.addEventListener("keydown", (event) => {
    if (state.view !== "pos" || event.defaultPrevented) return;
    const active = event.target;
    const tag = active?.tagName || "";
    const isEditing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    if (event.key === "/" && !isEditing) {
      event.preventDefault();
      focusMenuSearchSoon(true);
    } else if (event.key === "Escape" && active === els.menuSearchInput && els.menuSearchInput.value) {
      event.preventDefault();
      els.menuSearchInput.value = "";
      renderMenu();
    }
  });
  els.customItemForm.addEventListener("submit", addCustomItem);
  els.closeInvoiceButton.addEventListener("click", closeInvoice);
  els.quickPayFullButton.addEventListener("click", quickPayFillFull);
  const splitBillButton = document.getElementById("splitBillButton");
  if (splitBillButton) splitBillButton.addEventListener("click", openSplitBill);
  els.printButton.addEventListener("click", printLastInvoice);
  els.customerAddForm.addEventListener("submit", addCustomerFromCustomersPage);
  els.customerSearchInput.addEventListener("input", renderCustomers);
  els.customerStatusFilter.addEventListener("change", renderCustomers);
  els.customerStatementButton.addEventListener("click", printCustomerStatement);
  if (els.customerExcelExportButton) els.customerExcelExportButton.addEventListener("click", () => {
    if (requireManagerPermission("customer.export", "تصدير العملاء")) exportCustomersExcel();
  });
  if (els.customerDebtPrintButton) els.customerDebtPrintButton.addEventListener("click", () => {
    if (requireManagerPermission("customer.debtPrint", "طباعة قائمة الديون")) printCustomerDebtList();
  });
  if (els.customerBulkReminderButton) els.customerBulkReminderButton.addEventListener("click", () => {
    if (requireManagerPermission("customer.bulkReminder", "رسائل الديون الجماعية")) openBulkDebtReminders();
  });
  if (els.customerExcelImportInput) els.customerExcelImportInput.addEventListener("change", (event) => {
    if (!requireManagerPermission("customer.import", "استيراد العملاء")) {
      event.target.value = "";
      return;
    }
    importCustomersExcel(event.target.files[0]);
  });
  const customerWhatsappButton = document.getElementById("customerWhatsappButton");
  if (customerWhatsappButton) customerWhatsappButton.addEventListener("click", () => whatsappReminder(selectedCustomerId));
  if (els.customerEditForm) els.customerEditForm.addEventListener("submit", saveCustomerEditCard);
  if (els.customerMergeToggleButton) els.customerMergeToggleButton.addEventListener("click", () => {
    if (requireManagerPermission("customer.merge", "دمج العملاء")) toggleCustomerMergeBox();
  });
  if (els.customerMergeApplyButton) els.customerMergeApplyButton.addEventListener("click", () => {
    if (requireManagerPermission("customer.merge", "دمج العملاء")) mergeEditingCustomer();
  });
  if (els.customerEditBackdrop) els.customerEditBackdrop.addEventListener("click", closeCustomerEditCard);
  if (els.customerEditCloseButton) els.customerEditCloseButton.addEventListener("click", closeCustomerEditCard);
  if (els.customerEditCancelButton) els.customerEditCancelButton.addEventListener("click", closeCustomerEditCard);
  if (els.customerReminderBackdrop) els.customerReminderBackdrop.addEventListener("click", closeBulkDebtReminders);
  if (els.customerReminderCloseButton) els.customerReminderCloseButton.addEventListener("click", closeBulkDebtReminders);
  if (els.customerReminderCancelButton) els.customerReminderCancelButton.addEventListener("click", closeBulkDebtReminders);
  if (els.customerReminderCopyButton) els.customerReminderCopyButton.addEventListener("click", copyBulkDebtReminders);
  if (els.customerReminderList) {
    els.customerReminderList.addEventListener("click", (event) => {
      const copyButton = event.target.closest("[data-copy-reminder]");
      if (copyButton) copyCustomerDebtReminder(copyButton.dataset.copyReminder);
    });
  }
  els.customersList.addEventListener("click", (event) => {
    const waButton = event.target.closest("[data-whatsapp-customer]");
    if (waButton) {
      whatsappReminder(waButton.dataset.whatsappCustomer);
      return;
    }

    const settleButton = event.target.closest("[data-settle-customer]");
    if (settleButton) {
      startCustomerSettlement(settleButton.dataset.settleCustomer);
      return;
    }

    const editButton = event.target.closest("[data-edit-customer]");
    if (editButton) {
      editCustomer(editButton.dataset.editCustomer);
      return;
    }

    const deleteButton = event.target.closest("[data-remove-customer]");
    if (deleteButton) {
      if (!requireManagerPermission("customer.delete", "حذف العميل")) return;
      deleteCustomer(deleteButton.dataset.removeCustomer);
      return;
    }

    const button = event.target.closest("[data-customer-card]");
    if (!button) return;
    selectedCustomerId = button.dataset.customerCard;
    render();
  });
  els.settlementForm.addEventListener("submit", recordSettlement);
  if (els.settlementFillBalanceButton) els.settlementFillBalanceButton.addEventListener("click", fillSettlementBalance);
  els.cpAddButton.addEventListener("click", () => {
    if (!requireManagerPermission("customer.price", "تعديل الأسعار الخاصة")) return;
    const itemId = els.cpItemSelect.value;
    const price = Number(els.cpPriceInput.value);
    if (!selectedCustomerId) { showToast("اختر عميل أولاً."); return; }
    if (!itemId) { showToast("اختر صنف."); return; }
    if (isNaN(price) || price < 0) { showToast("اكتب سعر صحيح."); return; }
    setCustomerItemPrice(selectedCustomerId, itemId, price);
    els.cpPriceInput.value = "";
    els.cpItemSelect.value = "";
    showToast("تم حفظ السعر الخاص.");
    saveState();
    renderCustomerPrices();
    renderMenu();
  });

  els.customerPricesList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cp-remove]");
    if (!btn || !selectedCustomerId) return;
    if (!requireManagerPermission("customer.price", "تعديل الأسعار الخاصة")) return;
    removeCustomerItemPrice(selectedCustomerId, btn.dataset.cpRemove);
    showToast("تم حذف السعر الخاص.");
    saveState();
    renderCustomerPrices();
    renderMenu();
  });

  if (els.customerKpis) els.customerKpis.addEventListener("click", (event) => {
    const redeemButton = event.target.closest("[data-redeem-loyalty]");
    if (redeemButton) redeemLoyalty(redeemButton.dataset.redeemLoyalty);
  });

  els.ledgerList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-customer-ledger]");
    if (editButton) {
      if (!requireManagerPermission("invoice.edit", "تعديل الفاتورة")) return;
      state.view = "invoices";
      render();
      startEditInvoice(editButton.dataset.editCustomerLedger);
      return;
    }

    const cancelButton = event.target.closest("[data-cancel-customer-ledger]");
    if (cancelButton) {
      if (!requireManagerPermission("invoice.cancel", "إلغاء الفاتورة")) return;
      cancelInvoice(cancelButton.dataset.cancelCustomerLedger);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-customer-ledger]");
    if (deleteButton) {
      if (!requireManagerPermission("invoice.delete", "حذف الفاتورة")) return;
      deleteInvoice(deleteButton.dataset.deleteCustomerLedger);
    }
  });

  els.settlementModePayment.addEventListener("click", () => {
    settlementDebtMode = false;
    applySettlementMode(getCustomer(selectedCustomerId));
  });
  els.settlementModeDebt.addEventListener("click", () => {
    if (!requireManagerPermission("customer.manualDebt", "إضافة دين يدوي")) return;
    settlementDebtMode = true;
    applySettlementMode(getCustomer(selectedCustomerId));
  });
  const refreshSettlementLossHint = () => updateSettlementLossHint(getCustomer(selectedCustomerId));
  els.settlementAmountInput.addEventListener("input", refreshSettlementLossHint);
  els.settlementDiscountInput.addEventListener("input", refreshSettlementLossHint);
  const renderInvoicesFresh = () => { invoiceViewLimit = INVOICE_VIEW_STEP; renderInvoices(); };
  els.invoiceSearchInput.addEventListener("input", renderInvoicesFresh);
  els.invoiceStatusFilter.addEventListener("change", renderInvoicesFresh);
  if (els.invoiceTypeFilter) els.invoiceTypeFilter.addEventListener("change", renderInvoicesFresh);
  els.invoiceDateFromInput.addEventListener("change", renderInvoicesFresh);
  els.invoiceDateToInput.addEventListener("change", renderInvoicesFresh);
  els.invoiceDateSortInput.addEventListener("change", renderInvoicesFresh);
  els.invoiceEditForm.addEventListener("submit", saveEditedInvoice);
  els.invoiceEditCancelButton.addEventListener("click", cancelInvoiceEdit);
  els.invoiceEditAddMenuItemButton.addEventListener("click", addInvoiceEditMenuItem);
  els.invoiceEditAddCustomButton.addEventListener("click", addInvoiceEditCustomItem);
  els.invoiceEditItemsList.addEventListener("input", (event) => {
    if (event.target.closest("[data-invoice-edit-name], [data-invoice-edit-qty], [data-invoice-edit-price]")) {
      updateInvoiceEditItemTotals(Boolean(event.target.closest("[data-invoice-edit-qty], [data-invoice-edit-price]")));
    }
  });
  els.invoiceEditItemsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-invoice-edit-item]");
    if (button) removeInvoiceEditItem(button.dataset.removeInvoiceEditItem);
  });
  els.reportDateFromInput.addEventListener("change", () => { renderReports(); renderTopItemsAndPeakHours(); });
  els.reportDateToInput.addEventListener("change", () => { renderReports(); renderTopItemsAndPeakHours(); });
  els.dayReportButton.addEventListener("click", printDayReport);
  els.backupNowButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.export", "تصدير النسخة الاحتياطية")) exportData();
  });
  els.backupLaterButton.addEventListener("click", snoozeBackupReminder);
  els.lowStockThresholdInput.addEventListener("change", () => {
    state.lowStockThreshold = Math.max(0, Number(els.lowStockThresholdInput.value || 0));
    saveState();
    renderLowStock();
  });
  els.expenseForm.addEventListener("submit", recordExpense);
  if (els.consumptionTypeToggle) {
    els.consumptionTypeToggle.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-consumption-type]");
      if (btn) setConsumptionMode(btn.dataset.consumptionType);
    });
  }
  els.workerItemInput.addEventListener("change", fillWorkerItemCost);
  els.expenseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.expenseMethodInput.value);
    saveState();
  });
  els.workerTransactionForm.addEventListener("submit", recordWorkerTransaction);
  els.workerTransactionTypeInput.addEventListener("change", () => {
    state.lastWorkerTransactionType = workerTransactionTypeLabels[els.workerTransactionTypeInput.value]
      ? els.workerTransactionTypeInput.value
      : WORKER_ADVANCE_TYPE;
    saveState();
    renderWorkerTransactionTypeState(workerMonthlyAccount(getWorker(selectedWorkerId)));
  });
  els.workerTransactionMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.workerTransactionMethodInput.value);
    saveState();
  });
  els.workerAddForm.addEventListener("submit", addWorkerFromWorkersPage);
  els.workerSearchInput.addEventListener("input", renderExpenses);
  els.workerStatusFilter.addEventListener("change", renderExpenses);
  if (els.workerOwnPeriodInput) els.workerOwnPeriodInput.addEventListener("change", () => setWorkerOwnPeriod(els.workerOwnPeriodInput.value));
  if (els.workerOwnPeriodResetButton) els.workerOwnPeriodResetButton.addEventListener("click", resetWorkerOwnPeriod);
  els.workersList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-remove-worker]");
    if (deleteButton) {
      deleteWorker(deleteButton.dataset.removeWorker);
      return;
    }

    const button = event.target.closest("[data-worker-card]");
    if (!button) return;
    selectedWorkerId = button.dataset.workerCard;
    render();
  });
  els.workerLedgerList.addEventListener("click", (event) => {
    const expenseButton = event.target.closest("[data-remove-expense]");
    if (expenseButton) {
      deleteExpense(expenseButton.dataset.removeExpense);
      return;
    }

    const transactionButton = event.target.closest("[data-remove-worker-transaction]");
    if (transactionButton) deleteWorkerTransaction(transactionButton.dataset.removeWorkerTransaction);
  });
  els.invoiceTableBody.addEventListener("click", (event) => {
    const moreButton = event.target.closest("[data-show-more-invoices]");
    if (moreButton) {
      invoiceViewLimit += INVOICE_VIEW_STEP;
      renderInvoices();
      return;
    }

    const editButton = event.target.closest("[data-edit-invoice]");
    if (editButton) {
      if (!requireManagerPermission("invoice.edit", "تعديل الفاتورة")) return;
      startEditInvoice(editButton.dataset.editInvoice);
      return;
    }

    const printButton = event.target.closest("[data-print-invoice]");
    if (printButton) {
      printInvoiceById(printButton.dataset.printInvoice);
      return;
    }

    const cancelButton = event.target.closest("[data-cancel-invoice]");
    if (cancelButton) {
      if (!requireManagerPermission("invoice.cancel", "إلغاء الفاتورة")) return;
      cancelInvoice(cancelButton.dataset.cancelInvoice);
      return;
    }

    const button = event.target.closest("[data-delete-invoice]");
    if (!button) return;
    if (!requireManagerPermission("invoice.delete", "حذف الفاتورة")) return;
    deleteInvoice(button.dataset.deleteInvoice);
  });
  els.invoiceExcelExportButton.addEventListener("click", () => {
    if (requireManagerPermission("invoice.export", "تصدير الفواتير")) exportInvoicesExcel();
  });
  els.invoiceExcelImportInput.addEventListener("change", (event) => {
    if (!requireManagerPermission("invoice.import", "استيراد الفواتير")) {
      event.target.value = "";
      return;
    }
    importInvoicesExcel(event.target.files[0]);
  });
  els.menuExcelExportButton.addEventListener("click", exportMenuExcel);
  els.menuExcelImportInput.addEventListener("change", (event) => importMenuExcel(event.target.files[0]));

  // Period Close
  els.closePeriodFrom.addEventListener("change", onClosePeriodDateChange);
  els.closePeriodTo.addEventListener("change", onClosePeriodDateChange);
  els.closePeriodCalcButton.addEventListener("click", calcPeriodClose);
  els.closePayAllButton.addEventListener("click", closePayAll);
  if (els.confirmYesButton) els.confirmYesButton.addEventListener("click", () => resolveAppConfirm(true));
  if (els.confirmCancelButton) els.confirmCancelButton.addEventListener("click", () => resolveAppConfirm(false));
  if (els.confirmBackdrop) els.confirmBackdrop.addEventListener("click", () => resolveAppConfirm(false));
  if (els.mobileMoreButton) els.mobileMoreButton.addEventListener("click", openMoreSheet);
  if (els.mobileMoreBackdrop) els.mobileMoreBackdrop.addEventListener("click", closeMoreSheet);
  if (els.mobileMoreClose) els.mobileMoreClose.addEventListener("click", closeMoreSheet);
  if (els.mobileMoreSheet) els.mobileMoreSheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-view]")) closeMoreSheet();
  });
  if (els.themeToggleButton) els.themeToggleButton.addEventListener("click", toggleAppTheme);
  if (els.roleToggleButton) els.roleToggleButton.addEventListener("click", () => {
    if (isManagerMode()) {
      setUserRole("cashier");
      return;
    }
    requestManagerAccess();
  });
  if (els.guideShareButton) els.guideShareButton.addEventListener("click", shareBackup);
  if (els.guideBackupButton) els.guideBackupButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.export", "تصدير النسخة الاحتياطية")) exportData();
  });
  if (els.guideImportInput) els.guideImportInput.addEventListener("change", (event) => {
    if (!requireManagerPermission("backup.import", "استيراد نسخة احتياطية")) {
      event.target.value = "";
      return;
    }
    importData(event.target.files[0]);
  });
  if (els.restoreLatestBackupButton) els.restoreLatestBackupButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.restore", "استرجاع نسخة احتياطية")) restoreLatestLocalBackup();
  });
  // النسخ التلقائي لمجلد
  const folderBackupChooseButton = document.getElementById("folderBackupChooseButton");
  if (folderBackupChooseButton) folderBackupChooseButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.export", "إعداد النسخ التلقائي للمجلد")) chooseBackupFolder();
  });
  const folderBackupNowButton = document.getElementById("folderBackupNowButton");
  if (folderBackupNowButton) folderBackupNowButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.export", "حفظ نسخة للمجلد")) writeBackupToFolder(true);
  });
  const folderBackupDisableButton = document.getElementById("folderBackupDisableButton");
  if (folderBackupDisableButton) folderBackupDisableButton.addEventListener("click", disableFolderBackup);
  if (els.businessNameSaveButton) els.businessNameSaveButton.addEventListener("click", saveBusinessName);
  if (els.businessNameInput) els.businessNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveBusinessName(); } });

  // قفل البرنامج برمز PIN
  const pinSaveButton = document.getElementById("pinSaveButton");
  if (pinSaveButton) pinSaveButton.addEventListener("click", () => {
    const a = document.getElementById("pinNewInput").value;
    const b = document.getElementById("pinConfirmInput").value;
    if (a !== b) { showToast("الرمزان غير متطابقين."); return; }
    if (setAppPin(a)) {
      document.getElementById("pinNewInput").value = "";
      document.getElementById("pinConfirmInput").value = "";
    }
  });
  const pinClearButton = document.getElementById("pinClearButton");
  if (pinClearButton) pinClearButton.addEventListener("click", () => {
    const cur = document.getElementById("pinCurrentInput");
    if (clearAppPin(cur.value)) cur.value = "";
  });

  // حجم الطباعة (A4 / حراري)
  const printSizeSelect = document.getElementById("printSizeSelect");
  if (printSizeSelect) printSizeSelect.addEventListener("change", () => {
    state.printSize = ["a4", "80mm", "58mm"].includes(printSizeSelect.value) ? printSizeSelect.value : "a4";
    saveState();
    applyPrintSize();
    showToast("تم حفظ حجم الطباعة.");
  });

  const autoBackupToggle = document.getElementById("autoBackupToggle");
  if (autoBackupToggle) autoBackupToggle.addEventListener("change", () => {
    state.autoBackup = autoBackupToggle.checked;
    saveState();
    renderAutoBackupSetting();
    showToast(autoBackupToggle.checked ? "تم تفعيل النسخ التلقائي اليومي." : "تم إيقاف النسخ التلقائي.");
  });

  // إعدادات نقاط الولاء
  const loyaltyEnabledToggle = document.getElementById("loyaltyEnabledToggle");
  const loyaltyPerShekelInput = document.getElementById("loyaltyPerShekelInput");
  const loyaltyRewardPointsInput = document.getElementById("loyaltyRewardPointsInput");
  const loyaltyRewardValueInput = document.getElementById("loyaltyRewardValueInput");
  const syncLoyaltyInputs = () => {
    const l = state.loyalty || {};
    if (loyaltyEnabledToggle) loyaltyEnabledToggle.checked = l.enabled !== false;
    if (loyaltyPerShekelInput) loyaltyPerShekelInput.value = inputNumberValue(l.perShekel ?? 1);
    if (loyaltyRewardPointsInput) loyaltyRewardPointsInput.value = inputNumberValue(l.rewardPoints ?? 100);
    if (loyaltyRewardValueInput) loyaltyRewardValueInput.value = inputNumberValue(l.rewardValue ?? 10);
  };
  syncLoyaltyInputs();
  const saveLoyalty = () => {
    state.loyalty = {
      enabled: loyaltyEnabledToggle ? loyaltyEnabledToggle.checked : true,
      perShekel: Math.max(Number(loyaltyPerShekelInput && loyaltyPerShekelInput.value) || 1, 0.0001),
      rewardPoints: Math.max(Math.round(Number(loyaltyRewardPointsInput && loyaltyRewardPointsInput.value) || 100), 1),
      rewardValue: Math.max(Number(loyaltyRewardValueInput && loyaltyRewardValueInput.value) || 10, 0)
    };
    saveState();
    if (state.view === "customers") render();
    showToast("تم حفظ إعدادات النقاط.");
  };
  [loyaltyEnabledToggle, loyaltyPerShekelInput, loyaltyRewardPointsInput, loyaltyRewardValueInput].forEach((el) => {
    if (el) el.addEventListener("change", saveLoyalty);
  });
  els.closeApproveButton.addEventListener("click", approvePeriodClose);
  if (els.closeWithdrawButton) els.closeWithdrawButton.addEventListener("click", recordCloseWithdrawal);
  if (els.closeWithdrawList) {
    els.closeWithdrawList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-withdrawal]");
      if (button) removeOwnerWithdrawal(button.dataset.removeWithdrawal);
    });
  }
  els.closeHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-period-close]");
    if (button) { removePeriodClose(button.dataset.removePeriodClose); return; }
    const head = event.target.closest("[data-toggle-close]");
    if (head) toggleCloseDetail(head.dataset.toggleClose);
  });
  els.closeGoInventoryButton.addEventListener("click", () => {
    state.view = "inventory";
    render();
  });

  els.exportButton.addEventListener("click", () => {
    if (requireManagerPermission("backup.export", "تصدير النسخة الاحتياطية")) exportData();
  });
  els.importInput.addEventListener("change", (event) => {
    if (!requireManagerPermission("backup.import", "استيراد نسخة احتياطية")) {
      event.target.value = "";
      return;
    }
    importData(event.target.files[0]);
  });
  els.purchaseForm.addEventListener("submit", addPurchase);
  els.generalExpenseForm.addEventListener("submit", recordGeneralExpense);
  els.generalExpenseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.generalExpenseMethodInput.value);
    saveState();
  });
  els.purchaseMenuItemInput.addEventListener("change", syncPurchaseMenuItem);
  els.purchaseItemInput.addEventListener("input", autofillPurchaseUnitsFromHistory);
  els.purchaseItemInput.addEventListener("change", autofillPurchaseUnitsFromHistory);
  els.purchaseQtyInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseUnitInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseStockQtyInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseStockUnitInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseAmountInput.addEventListener("input", renderPurchaseUnitCost);
  els.savePurchaseInvoiceButton.addEventListener("click", savePurchaseInvoice);
  els.clearPurchaseInvoiceButton.addEventListener("click", clearPurchaseDraft);
  els.purchaseEditCancelButton.addEventListener("click", cancelPurchaseEdit);
  els.purchaseDraftList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-purchase-draft]");
    if (editButton) {
      editPurchaseDraftLine(editButton.dataset.editPurchaseDraft);
      return;
    }
    const button = event.target.closest("[data-remove-purchase-draft]");
    if (button) removePurchaseDraftLine(button.dataset.removePurchaseDraft);
  });
  els.purchaseSearchInput.addEventListener("input", renderPurchases);
  ["purchaseDateFromInput", "purchaseDateToInput", "purchaseDateSortInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderPurchases);
  });
  els.purchasesList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-purchase]");
    if (editButton) {
      startEditPurchase(editButton.dataset.editPurchase);
      return;
    }

    const button = event.target.closest("[data-remove-purchase]");
    if (button) removePurchase(button.dataset.removePurchase);
  });
  els.generalExpensesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-general-expense]");
    if (button) removeGeneralExpense(button.dataset.removeGeneralExpense);
  });

  // حساب المورّد بالدين: نموذج التسديد + تعبئة الاسم بالنقر
  const supplierPayForm = document.getElementById("supplierPayForm");
  if (supplierPayForm) supplierPayForm.addEventListener("submit", paySupplier);
  const supplierDebtList = document.getElementById("supplierDebtList");
  if (supplierDebtList) supplierDebtList.addEventListener("click", (event) => {
    const payButton = event.target.closest("[data-pay-supplier]");
    if (!payButton) return;
    const nameInput = document.getElementById("supplierPayNameInput");
    if (nameInput) { nameInput.value = payButton.dataset.paySupplier; nameInput.focus(); }
    const amountInput = document.getElementById("supplierPayAmountInput");
    if (amountInput) amountInput.focus();
  });
  els.inventorySearchInput.addEventListener("input", renderInventory);
  els.inventoryScopeInput.addEventListener("change", renderInventory);
  els.inventoryFillButton.addEventListener("click", fillInventoryFromSystem);
  els.inventorySaveButton.addEventListener("click", saveInventoryCount);
  els.inventoryHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-inventory-count]");
    if (button) removeInventoryCount(button.dataset.removeInventoryCount);
  });
  els.inventoryList.addEventListener("input", (event) => {
    if (event.target.closest("[data-inventory-actual], [data-inventory-note]")) {
      updateInventoryCalculations();
    }
  });
  els.menuComponentAddButton.addEventListener("click", addMenuComponent);
  const menuOptionAddButton = document.getElementById("menuOptionAddButton");
  if (menuOptionAddButton) menuOptionAddButton.addEventListener("click", addMenuOption);

  // إدارة العروض / الكومبو
  const comboAddItemButton = document.getElementById("comboAddItemButton");
  if (comboAddItemButton) comboAddItemButton.addEventListener("click", addComboDraftItem);
  const comboSaveButton = document.getElementById("comboSaveButton");
  if (comboSaveButton) comboSaveButton.addEventListener("click", saveCombo);
  const comboDraftList = document.getElementById("comboDraftList");
  if (comboDraftList) comboDraftList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-combo-draft]");
    if (!btn) return;
    comboDraft = comboDraft.filter((ci) => ci.menuItemId !== btn.dataset.removeComboDraft);
    renderComboDraft();
  });
  const comboList = document.getElementById("comboList");
  if (comboList) comboList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-combo]");
    if (btn) deleteCombo(btn.dataset.removeCombo);
  });
  const menuOptionsList = document.getElementById("menuOptionsList");
  if (menuOptionsList) menuOptionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-option]");
    if (!button) return;
    menuOptionsDraft = menuOptionsDraft.filter((opt) => opt.id !== button.dataset.removeOption);
    renderMenuOptionsEditor();
  });
  els.menuComponentsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-component]");
    if (!button) return;
    menuComponentDraft = menuComponentDraft.filter((component) => component.id !== button.dataset.removeComponent);
    renderMenuComponentsEditor();
  });
  els.menuForm.addEventListener("submit", saveMenuItem);
  els.menuOperatingCostInput.addEventListener("input", renderMenuComponentsEditor);
  els.menuOperatingCostTypeInput.addEventListener("change", renderMenuComponentsEditor);
  els.menuCancelEditButton.addEventListener("click", () => {
    setMenuFormMode();
    render();
  });
  els.menuStatsDateFromInput.addEventListener("change", renderSettingsMenu);
  els.menuStatsDateToInput.addEventListener("change", renderSettingsMenu);
  els.settingsMenuSearchInput.addEventListener("input", renderSettingsMenu);
  els.settingsMenuList.addEventListener("click", (event) => {
    const favButton = event.target.closest("[data-toggle-favorite]");
    if (favButton) { toggleMenuFavorite(favButton.dataset.toggleFavorite); return; }
    const moveUp = event.target.closest("[data-move-menu-up]");
    if (moveUp) { moveMenuItem(moveUp.dataset.moveMenuUp, "up"); return; }
    const moveDown = event.target.closest("[data-move-menu-down]");
    if (moveDown) { moveMenuItem(moveDown.dataset.moveMenuDown, "down"); return; }
    const editButton = event.target.closest("[data-edit-menu]");
    if (editButton) {
      editMenuItem(editButton.dataset.editMenu);
      return;
    }
    const removeButton = event.target.closest("[data-remove-menu]");
    if (removeButton) removeMenuItem(removeButton.dataset.removeMenu);
  });

  // سحب وإفلات لإعادة ترتيب الأصناف (بالماوس على الكمبيوتر)
  let draggedMenuId = null;
  els.settingsMenuList.addEventListener("dragstart", (event) => {
    const row = event.target.closest("[data-menu-id]");
    if (!row) return;
    draggedMenuId = row.dataset.menuId;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    row.classList.add("is-dragging");
  });
  els.settingsMenuList.addEventListener("dragend", (event) => {
    const row = event.target.closest("[data-menu-id]");
    if (row) row.classList.remove("is-dragging");
    draggedMenuId = null;
  });
  els.settingsMenuList.addEventListener("dragover", (event) => {
    if (draggedMenuId) event.preventDefault();
  });
  els.settingsMenuList.addEventListener("drop", (event) => {
    event.preventDefault();
    const row = event.target.closest("[data-menu-id]");
    if (row && draggedMenuId) dropMenuItem(draggedMenuId, row.dataset.menuId);
  });
}

// تهيئة الحالة (كانت في أول app.js — انتقلت هنا لأن loadState يحتاج دوال من كل الملفات)
state = loadState();
applyAppTheme();
currentUserRole = hasAppPin() ? "cashier" : "manager";
selectedCustomerId = state.customers[0]?.id || null;
selectedWorkerId = state.workers[0]?.id || null;
lastClosedInvoice = state.invoices[0] || null;

wireEvents();
state.view = state.view || "pos";
setLastPaymentMethod(getLastPaymentMethod());
getOpenOrder();
render();
focusMenuSearchSoon();
renderPinSettings();
applyPrintSize();
renderPrintSizeSetting();
renderAutoBackupSetting();
showLockScreen();
recoverFromDurableBackup();
setTimeout(() => { try { maybeAutoDailyBackup(); } catch (error) {} }, 1800);
setTimeout(() => { try { maybeDailyFolderBackup(); } catch (error) {} }, 2200);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        if (!nextWorker) return;

        nextWorker.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            nextWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    })
    .catch(() => {});
}

// ─── حارس التبويب الواحد: منع فتح البرنامج بتبويبين ─────────────────────────

if (typeof BroadcastChannel !== "undefined") {
  const tabGuardChannel = new BroadcastChannel("cafe-pos-tab-guard");
  let tabGuardBlocked = false;

  function showTabGuardOverlay() {
    if (document.getElementById("tabGuardOverlay")) return;
    tabGuardBlocked = true;
    const overlay = document.createElement("div");
    overlay.id = "tabGuardOverlay";
    overlay.className = "tab-guard-overlay";
    overlay.innerHTML = `
      <div class="tab-guard-box">
        <div class="tab-guard-icon">⚠️</div>
        <h2>البرنامج مفتوح في مكان آخر</h2>
        <p>دفتر المقهى مفتوح في تبويب أو نافذة ثانية. الشغل على نسختين بنفس الوقت بيخرب البيانات — آخر نسخة بتحفظ بتمسح تعديلات الثانية.</p>
        <p><strong>أغلق هذا التبويب واشتغل على التبويب الأول.</strong></p>
        <button class="tab-guard-force" type="button">أعرف المخاطر — استخدم هذا التبويب</button>
      </div>
    `;
    overlay.querySelector(".tab-guard-force").addEventListener("click", () => {
      tabGuardBlocked = false;
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  tabGuardChannel.onmessage = (event) => {
    if (event.data === "hello" && !tabGuardBlocked) {
      // في تبويب جديد فتح — أعلمه إني موجود
      tabGuardChannel.postMessage("taken");
    } else if (event.data === "taken") {
      // في تبويب أقدم شغال — احجب هذا التبويب
      showTabGuardOverlay();
    }
  };

  tabGuardChannel.postMessage("hello");
}
