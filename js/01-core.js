// ═══ دفتر المقهى ═══ 01-core.js — الإعدادات، الحالة، التخزين، النسخ الاحتياطي
// (مقسوم من app.js — الأسطر 1-514)

const STORAGE_KEY = "cafe-pos-ledger-v1";
const APP_THEME_KEY = "cafe-pos-theme";
const AUTO_BACKUP_KEY = "cafe-pos-ledger-v1-auto-backup";
const BACKUP_HISTORY_KEY = "cafe-pos-ledger-v1-backup-history";
const BACKUP_DB_NAME = "cafe-pos-ledger-backups";
const BACKUP_STORE_NAME = "snapshots";
const MAX_BACKUP_HISTORY = 10;
const MAX_AUDIT_LOG = 500;
const DEFAULT_TABLE_COUNT = 14;
const ENABLE_LINKING = false;
const ENABLE_STOCK_COMPONENTS = true;

const defaultMenu = [
  { id: "coffee-arabic", name: "قهوة عربية", price: 8, category: "مشروبات" },
  { id: "coffee-turkish", name: "قهوة تركية", price: 10, category: "مشروبات" },
  { id: "tea", name: "شاي", price: 6, category: "مشروبات" },
  { id: "nescafe", name: "نسكافيه", price: 12, category: "مشروبات" },
  { id: "mint", name: "نعنع وليمون", price: 14, category: "بارد" },
  { id: "water", name: "ماء", price: 4, category: "بارد" },
  { id: "shisha-apple", name: "شيشة تفاحتين", price: 25, category: "شيشة" },
  { id: "shisha-mint", name: "شيشة نعنع", price: 25, category: "شيشة" },
  { id: "coal", name: "راس فحم", price: 5, category: "شيشة" },
  { id: "cake", name: "قطعة كيك", price: 16, category: "حلويات" },
  { id: "cookies", name: "بسكويت", price: 7, category: "حلويات" },
  { id: "sandwich", name: "سندويشة خفيفة", price: 18, category: "أكل" }
];

const paymentLabels = {
  cash: "كاش",
  bank: "تطبيق بنك",
  wallet: "محفظة"
};

const paymentMethods = Object.keys(paymentLabels);
const operatingCostLabels = {
  gas: "غاز",
  electricity: "كهربا",
  labor: "عمال",
  other: "أخرى"
};
const operatingCostTypes = Object.keys(operatingCostLabels);
const workerConsumptionTypeLabels = {
  free: "مجاني للعامل",
  worker_price: "سعر عامل",
  salary: "خصم من الراتب"
};
const FREE_WORKER_CONSUMPTION_TYPE = "free";
const SALARY_WORKER_CONSUMPTION_TYPE = "salary";
const workerTransactionTypeLabels = {
  advance: "سلفة",
  salary_payment: "قبضة / راتب"
};
const WORKER_ADVANCE_TYPE = "advance";
const WORKER_SALARY_PAYMENT_TYPE = "salary_payment";

let stateNeedsBackupRecovery = false;
let backupWriteTimer = null;
// تتعبى فعلياً في js/12-init.js بعد تحميل كل الملفات (loadState يحتاج دوال من 02-domain)
let state = null;
let selectedCategory = "الكل";
let expandedMenuOptionsItemId = "";
let optionPickerCleanup = null;
let preferredMenuOptionByItemId = {};
let selectedCustomerId = null;
let selectedWorkerId = null;
let lastClosedInvoice = null;
let purchaseDraftItems = [];
let purchaseUnitAutofillState = {};
let inventoryDraft = {};
let menuComponentDraft = [];
let menuOptionsDraft = [];
let comboDraft = [];
let invoiceViewLimit = 100;
const INVOICE_VIEW_STEP = 100;
let invoiceEditItemsDraft = [];
let editingCustomerId = null;
let editingMenuItemId = null;
let editingInvoiceId = null;
let editingPurchaseId = null;
let settlementDebtMode = false;
let workerConsumptionMode = "worker_price"; // worker_price | salary | free
let expandedCloseId = null;
let cashboxAction = null;
const CASHIER_ALLOWED_VIEWS = new Set(["pos", "invoices", "customers"]);
const MANAGER_ONLY_PERMISSIONS = new Set([
  "backup.export",
  "backup.import",
  "backup.restore",
  "customer.bulkReminder",
  "customer.delete",
  "customer.debtPrint",
  "customer.export",
  "customer.import",
  "customer.manualDebt",
  "customer.merge",
  "customer.payout",
  "customer.price",
  "invoice.cancel",
  "invoice.delete",
  "invoice.edit",
  "invoice.export",
  "invoice.import"
]);
let currentUserRole = "manager";

function isManagerMode() {
  return currentUserRole === "manager";
}

function isManagerOnlyView(view) {
  return view && !CASHIER_ALLOWED_VIEWS.has(view);
}

function canAccessView(view) {
  return isManagerMode() || !isManagerOnlyView(view || "pos");
}

function canUsePermission(permission) {
  return isManagerMode() || !MANAGER_ONLY_PERMISSIONS.has(permission);
}

function requireManagerPermission(permission, label = "هذا الإجراء") {
  if (canUsePermission(permission)) return true;
  showToast(`${label} يحتاج صلاحية مدير.`);
  if (typeof requestManagerAccess === "function") requestManagerAccess(state?.view || "pos");
  return false;
}

function ensurePermittedView() {
  if (!canAccessView(state?.view || "pos")) state.view = "pos";
}

const $ = (selector) => document.querySelector(selector);

const els = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  statsStrip: $("#statsStrip"),
  tablesGrid: $("#tablesGrid"),
  orderPanel: $(".order-panel"),
  newOrderButton: $("#newOrderButton"),
  addTableButton: $("#addTableButton"),
  tableMergeButton: $("#tableMergeButton"),
  deleteTableButton: $("#deleteTableButton"),
  orderSubtitle: $("#orderSubtitle"),
  tableNameInput: $("#tableNameInput"),
  orderStatus: $("#orderStatus"),
  customerNameInput: $("#customerNameInput"),
  customerSuggestions: $("#customerSuggestions"),
  customerPhoneInput: $("#customerPhoneInput"),
  customerSelect: $("#customerSelect"),
  saveCustomerButton: $("#saveCustomerButton"),
  posCustomerAccountCard: $("#posCustomerAccountCard"),
  menuSearchInput: $("#menuSearchInput"),
  quickMenuItems: $("#quickMenuItems"),
  customItemForm: $("#customItemForm"),
  customItemNameInput: $("#customItemNameInput"),
  customItemPriceInput: $("#customItemPriceInput"),
  menuCategories: $("#menuCategories"),
  menuGrid: $("#menuGrid"),
  orderItems: $("#orderItems"),
  clearOrderButton: $("#clearOrderButton"),
  discountInput: $("#discountInput"),
  paymentMethodInput: $("#paymentMethodInput"),
  paymentAmountInput: $("#paymentAmountInput"),
  changeReturnedInput: $("#changeReturnedInput"),
  noteInput: $("#noteInput"),
  subtotalValue: $("#subtotalValue"),
  totalValue: $("#totalValue"),
  profitWarning: $("#profitWarning"),
  balanceResult: $("#balanceResult"),
  closeInvoiceButton: $("#closeInvoiceButton"),
  printButton: $("#printButton"),
  customerAccountBox: $("#customerAccountBox"),
  statTodaySales: $("#statTodaySales"),
  statTodayPurchases: $("#statTodayPurchases"),
  statItemProfit: $("#statItemProfit"),
  statNetProfit: $("#statNetProfit"),
  openOrdersBadge: $("#openOrdersBadge"),
  customerTotalDebt: $("#customerTotalDebt"),
  customerTotalCredit: $("#customerTotalCredit"),
  customerAddForm: $("#customerAddForm"),
  customerAddNameInput: $("#customerAddNameInput"),
  customerAddPhoneInput: $("#customerAddPhoneInput"),
  customerSearchInput: $("#customerSearchInput"),
  customerStatusFilter: $("#customerStatusFilter"),
  customerExcelExportButton: $("#customerExcelExportButton"),
  customerExcelImportInput: $("#customerExcelImportInput"),
  customerDebtPrintButton: $("#customerDebtPrintButton"),
  customerBulkReminderButton: $("#customerBulkReminderButton"),
  customersList: $("#customersList"),
  customerDetailName: $("#customerDetailName"),
  customerDetailMeta: $("#customerDetailMeta"),
  customerStatementButton: $("#customerStatementButton"),
  customerKpis: $("#customerKpis"),
  customerEditModal: $("#customerEditModal"),
  customerEditBackdrop: $("#customerEditBackdrop"),
  customerEditForm: $("#customerEditForm"),
  customerEditTitle: $("#customerEditTitle"),
  customerEditMeta: $("#customerEditMeta"),
  customerEditNameInput: $("#customerEditNameInput"),
  customerEditPhoneInput: $("#customerEditPhoneInput"),
  customerMergeToggleButton: $("#customerMergeToggleButton"),
  customerMergeBox: $("#customerMergeBox"),
  customerMergeTargetInput: $("#customerMergeTargetInput"),
  customerMergeApplyButton: $("#customerMergeApplyButton"),
  customerEditCloseButton: $("#customerEditCloseButton"),
  customerEditCancelButton: $("#customerEditCancelButton"),
  customerReminderModal: $("#customerReminderModal"),
  customerReminderBackdrop: $("#customerReminderBackdrop"),
  customerReminderCloseButton: $("#customerReminderCloseButton"),
  customerReminderCancelButton: $("#customerReminderCancelButton"),
  customerReminderCopyButton: $("#customerReminderCopyButton"),
  customerReminderMeta: $("#customerReminderMeta"),
  customerReminderList: $("#customerReminderList"),
  cpItemSelect: $("#cpItemSelect"),
  cpPriceInput: $("#cpPriceInput"),
  cpAddButton: $("#cpAddButton"),
  customerPricesList: $("#customerPricesList"),
  settlementForm: $("#settlementForm"),
  settlementTitle: $("#settlementTitle"),
  settlementModeToggle: $("#settlementModeToggle"),
  settlementModePayment: $("#settlementModePayment"),
  settlementModeDebt: $("#settlementModeDebt"),
  settlementAmountInput: $("#settlementAmountInput"),
  settlementFillBalanceButton: $("#settlementFillBalanceButton"),
  settlementDiscountField: $("#settlementDiscountField"),
  settlementDiscountInput: $("#settlementDiscountInput"),
  settlementMethodInput: $("#settlementMethodInput"),
  settlementMethodField: $("#settlementMethodField"),
  settlementNoteField: $("#settlementNoteField"),
  settlementNoteInput: $("#settlementNoteInput"),
  settlementSubmitButton: $("#settlementSubmitButton"),
  ledgerList: $("#ledgerList"),
  invoiceSearchInput: $("#invoiceSearchInput"),
  invoiceStatusFilter: $("#invoiceStatusFilter"),
  invoiceTypeFilter: $("#invoiceTypeFilter"),
  invoiceDateFromInput: $("#invoiceDateFromInput"),
  invoiceDateToInput: $("#invoiceDateToInput"),
  invoiceDateSortInput: $("#invoiceDateSortInput"),
  invoiceNetTotal: $("#invoiceNetTotal"),
  invoicePaidTotal: $("#invoicePaidTotal"),
  invoicePaymentBreakdown: $("#invoicePaymentBreakdown"),
  invoiceNetCount: $("#invoiceNetCount"),
  invoiceEditForm: $("#invoiceEditForm"),
  invoiceEditTitle: $("#invoiceEditTitle"),
  invoiceEditCancelButton: $("#invoiceEditCancelButton"),
  invoiceEditCustomerInput: $("#invoiceEditCustomerInput"),
  invoiceEditPhoneInput: $("#invoiceEditPhoneInput"),
  invoiceEditDateInput: $("#invoiceEditDateInput"),
  invoiceEditTableInput: $("#invoiceEditTableInput"),
  invoiceEditTotalInput: $("#invoiceEditTotalInput"),
  invoiceEditPaidInput: $("#invoiceEditPaidInput"),
  invoiceEditDiscountField: $("#invoiceEditDiscountField"),
  invoiceEditDiscountInput: $("#invoiceEditDiscountInput"),
  invoiceEditMethodInput: $("#invoiceEditMethodInput"),
  invoiceEditItemsSection: $("#invoiceEditItemsSection"),
  invoiceEditSubtotalValue: $("#invoiceEditSubtotalValue"),
  invoiceEditMenuItemInput: $("#invoiceEditMenuItemInput"),
  invoiceEditAddMenuItemButton: $("#invoiceEditAddMenuItemButton"),
  invoiceEditCustomNameInput: $("#invoiceEditCustomNameInput"),
  invoiceEditCustomPriceInput: $("#invoiceEditCustomPriceInput"),
  invoiceEditAddCustomButton: $("#invoiceEditAddCustomButton"),
  invoiceEditItemsList: $("#invoiceEditItemsList"),
  invoiceEditNoteInput: $("#invoiceEditNoteInput"),
  invoiceTableBody: $("#invoiceTableBody"),
  invoiceExcelExportButton: $("#invoiceExcelExportButton"),
  invoiceExcelImportInput: $("#invoiceExcelImportInput"),
  reportDateFromInput: $("#reportDateFromInput"),
  reportDateToInput: $("#reportDateToInput"),
  reportRangeText: $("#reportRangeText"),
  reportSummaryGrid: $("#reportSummaryGrid"),
  cashOnHandBox: $("#cashOnHandBox"),
  todayCashStrip: $("#todayCashStrip"),
  reportPaymentsList: $("#reportPaymentsList"),
  reportItemsList: $("#reportItemsList"),
  reportCustomersList: $("#reportCustomersList"),
  reportInvoicesList: $("#reportInvoicesList"),
  reportPurchasesList: $("#reportPurchasesList"),
  reportGeneralExpensesList: $("#reportGeneralExpensesList"),
  reportInventoryList: $("#reportInventoryList"),
  reportExpensesList: $("#reportExpensesList"),
  reportWorkersList: $("#reportWorkersList"),
  expenseForm: $("#expenseForm"),
  expenseDateInput: $("#expenseDateInput"),
  expenseTitleInput: $("#expenseTitleInput"),
  expenseAmountInput: $("#expenseAmountInput"),
  workerItemInput: $("#workerItemInput"),
  workerQtyInput: $("#workerQtyInput"),
  expenseMethodInput: $("#expenseMethodInput"),
  expenseMethodField: $("#expenseMethodField"),
  expenseAmountField: $("#expenseAmountField"),
  expenseAmountLabel: $("#expenseAmountLabel"),
  consumptionTypeToggle: $("#consumptionTypeToggle"),
  expenseNoteInput: $("#expenseNoteInput"),
  generalExpenseForm: $("#generalExpenseForm"),
  generalExpenseDateInput: $("#generalExpenseDateInput"),
  generalExpenseTitleInput: $("#generalExpenseTitleInput"),
  generalExpenseAmountInput: $("#generalExpenseAmountInput"),
  generalExpenseMethodInput: $("#generalExpenseMethodInput"),
  generalExpenseNoteInput: $("#generalExpenseNoteInput"),
  generalExpenseTotalBox: $("#generalExpenseTotalBox"),
  generalExpensesList: $("#generalExpensesList"),
  workerAddForm: $("#workerAddForm"),
  workerAddNameInput: $("#workerAddNameInput"),
  workerAddPhoneInput: $("#workerAddPhoneInput"),
  workerAddSalaryInput: $("#workerAddSalaryInput"),
  workerSearchInput: $("#workerSearchInput"),
  workerStatusFilter: $("#workerStatusFilter"),
  workerTotalDue: $("#workerTotalDue"),
  workerTotalAdvance: $("#workerTotalAdvance"),
  workerTotalSalaryPaid: $("#workerTotalSalaryPaid"),
  workerTotalCharged: $("#workerTotalCharged"),
  workersList: $("#workersList"),
  workerDetailName: $("#workerDetailName"),
  workerDetailMeta: $("#workerDetailMeta"),
  workerKpis: $("#workerKpis"),
  workerPeriodRow: $("#workerPeriodRow"),
  workerOwnPeriodInput: $("#workerOwnPeriodInput"),
  workerOwnPeriodResetButton: $("#workerOwnPeriodResetButton"),
  workerTransactionForm: $("#workerTransactionForm"),
  workerTransactionDateInput: $("#workerTransactionDateInput"),
  workerTransactionTypeInput: $("#workerTransactionTypeInput"),
  workerTransactionAmountInput: $("#workerTransactionAmountInput"),
  workerTransactionMethodInput: $("#workerTransactionMethodInput"),
  workerTransactionNoteInput: $("#workerTransactionNoteInput"),
  workerTransactionSubmitButton: $("#workerTransactionSubmitButton"),
  workerLedgerList: $("#workerLedgerList"),
  exportButton: $("#exportButton"),
  importInput: $("#importInput"),
  purchaseForm: $("#purchaseForm"),
  purchaseMenuItemInput: $("#purchaseMenuItemInput"),
  purchaseItemInput: $("#purchaseItemInput"),
  purchaseSupplierInput: $("#purchaseSupplierInput"),
  purchaseQtyInput: $("#purchaseQtyInput"),
  purchaseUnitInput: $("#purchaseUnitInput"),
  purchaseStockQtyInput: $("#purchaseStockQtyInput"),
  purchaseStockUnitInput: $("#purchaseStockUnitInput"),
  purchaseAmountInput: $("#purchaseAmountInput"),
  purchaseUnitCostValue: $("#purchaseUnitCostValue"),
  purchaseMethodInput: $("#purchaseMethodInput"),
  purchaseNoteInput: $("#purchaseNoteInput"),
  purchaseDraftBox: $("#purchaseDraftBox"),
  purchaseDraftTitle: $("#purchaseDraftTitle"),
  purchaseDraftSubtitle: $("#purchaseDraftSubtitle"),
  purchaseDraftTotal: $("#purchaseDraftTotal"),
  purchaseDraftList: $("#purchaseDraftList"),
  savePurchaseInvoiceButton: $("#savePurchaseInvoiceButton"),
  clearPurchaseInvoiceButton: $("#clearPurchaseInvoiceButton"),
  purchaseEditCancelButton: $("#purchaseEditCancelButton"),
  purchaseSearchInput: $("#purchaseSearchInput"),
  purchaseTotalBox: $("#purchaseTotalBox"),
  purchasesList: $("#purchasesList"),
  inventorySearchInput: $("#inventorySearchInput"),
  inventoryScopeInput: $("#inventoryScopeInput"),
  inventoryNoteInput: $("#inventoryNoteInput"),
  inventoryFillButton: $("#inventoryFillButton"),
  inventorySaveButton: $("#inventorySaveButton"),
  inventoryStockSummary: $("#inventoryStockSummary"),
  inventoryStockList: $("#inventoryStockList"),
  inventorySummary: $("#inventorySummary"),
  inventoryList: $("#inventoryList"),
  inventoryHistoryList: $("#inventoryHistoryList"),
  menuForm: $("#menuForm"),
  menuFormTitle: $("#menuFormTitle"),
  menuNameInput: $("#menuNameInput"),
  menuPriceInput: $("#menuPriceInput"),
  menuCostInput: $("#menuCostInput"),
  menuOperatingCostInput: $("#menuOperatingCostInput"),
  menuOperatingCostTypeInput: $("#menuOperatingCostTypeInput"),
  menuCategoryInput: $("#menuCategoryInput"),
  menuComponentItemInput: $("#menuComponentItemInput"),
  menuComponentQtyInput: $("#menuComponentQtyInput"),
  menuComponentAddButton: $("#menuComponentAddButton"),
  menuComponentsList: $("#menuComponentsList"),
  menuSubmitButton: $("#menuSubmitButton"),
  menuCancelEditButton: $("#menuCancelEditButton"),
  settingsMenuSearchInput: $("#settingsMenuSearchInput"),
  menuStatsDateFromInput: $("#menuStatsDateFromInput"),
  menuStatsDateToInput: $("#menuStatsDateToInput"),
  menuStatsRangeText: $("#menuStatsRangeText"),
  menuStatsSummary: $("#menuStatsSummary"),
  settingsMenuList: $("#settingsMenuList"),
  menuExcelExportButton: $("#menuExcelExportButton"),
  menuExcelImportInput: $("#menuExcelImportInput"),
  closePeriodFrom: $("#closePeriodFrom"),
  closePeriodTo: $("#closePeriodTo"),
  closePeriodDays: $("#closePeriodDays"),
  closePeriodCalcButton: $("#closePeriodCalcButton"),
  closePeriodResult: $("#closePeriodResult"),
  closeWorkerSubtitle: $("#closeWorkerSubtitle"),
  closeWorkersTable: $("#closeWorkersTable"),
  closePayAllButton: $("#closePayAllButton"),
  closeGoInventoryButton: $("#closeGoInventoryButton"),
  closeInventorySubtitle: $("#closeInventorySubtitle"),
  closeInventoryInfo: $("#closeInventoryInfo"),
  closeSummary: $("#closeSummary"),
  lastCloseBanner: $("#lastCloseBanner"),
  closeApproveButton: $("#closeApproveButton"),
  closeOverlapWarning: $("#closeOverlapWarning"),
  closeHistoryList: $("#closeHistoryList"),
  closeWithdrawAmount: $("#closeWithdrawAmount"),
  closeWithdrawMethod: $("#closeWithdrawMethod"),
  closeWithdrawButton: $("#closeWithdrawButton"),
  closeWithdrawList: $("#closeWithdrawList"),
  backupReminderBanner: $("#backupReminderBanner"),
  backupNowButton: $("#backupNowButton"),
  backupLaterButton: $("#backupLaterButton"),
  dayReportButton: $("#dayReportButton"),
  reportTopItemsList: $("#reportTopItemsList"),
  reportHoursChart: $("#reportHoursChart"),
  lowStockPanel: $("#lowStockPanel"),
  lowStockList: $("#lowStockList"),
  purchaseSuggestionsList: $("#purchaseSuggestionsList"),
  lowStockThresholdInput: $("#lowStockThresholdInput"),
  quickPayFullButton: $("#quickPayFullButton"),
  brandTitle: $("#brandTitle"),
  brandMark: $("#brandMark"),
  themeToggleButton: $("#themeToggleButton"),
  roleToggleButton: $("#roleToggleButton"),
  businessNameInput: $("#businessNameInput"),
  businessNameSaveButton: $("#businessNameSaveButton"),
  guideLive: $("#guideLive"),
  guideBackupButton: $("#guideBackupButton"),
  guideShareButton: $("#guideShareButton"),
  guideImportInput: $("#guideImportInput"),
  guideBackupStatus: $("#guideBackupStatus"),
  backupCenter: $("#backupCenter"),
  restoreLatestBackupButton: $("#restoreLatestBackupButton"),
  mobileMoreButton: $("#mobileMoreButton"),
  mobileMoreSheet: $("#mobileMoreSheet"),
  mobileMoreBackdrop: $("#mobileMoreBackdrop"),
  mobileMoreClose: $("#mobileMoreClose"),
  confirmModal: $("#confirmModal"),
  confirmBackdrop: $("#confirmBackdrop"),
  confirmIcon: $("#confirmIcon"),
  confirmMessage: $("#confirmMessage"),
  confirmYesButton: $("#confirmYesButton"),
  confirmCancelButton: $("#confirmCancelButton"),
  toast: $("#toast"),
  printTemplate: $("#printTemplate")
};

let _confirmResolver = null;

function appConfirm(message, options = {}) {
  return new Promise((resolve) => {
    if (!els.confirmModal) { resolve(window.confirm(message)); return; }
    _confirmResolver = resolve;
    els.confirmMessage.textContent = message;
    els.confirmIcon.textContent = options.icon || "⚠️";
    els.confirmYesButton.textContent = options.yesLabel || "تأكيد";
    els.confirmCancelButton.textContent = options.cancelLabel || "إلغاء";
    els.confirmYesButton.classList.toggle("is-danger", options.danger !== false);
    els.confirmModal.hidden = false;
  });
}

function resolveAppConfirm(value) {
  if (els.confirmModal) els.confirmModal.hidden = true;
  const resolver = _confirmResolver;
  _confirmResolver = null;
  if (value === true) armUndoSnapshot();
  if (resolver) resolver(value);
}

// ─── التراجع عن آخر عملية مؤكَّدة (حذف وغيره) ─────────────────
let undoSnapshotJson = null;
let undoArmedAt = 0;

function armUndoSnapshot() {
  try {
    undoSnapshotJson = JSON.stringify(state);
    undoArmedAt = Date.now();
  } catch (error) {
    undoSnapshotJson = null;
    undoArmedAt = 0;
  }
}

function isUndoArmed() {
  return !!undoSnapshotJson && (Date.now() - undoArmedAt < 1500);
}

function performUndo() {
  if (!undoSnapshotJson) return;
  try {
    const restored = normalizeState(JSON.parse(undoSnapshotJson));
    undoSnapshotJson = null;
    undoArmedAt = 0;
    state = restored;
    saveState();
    if (typeof render === "function") render();
    showToast("تم التراجع. ↩️");
  } catch (error) {
    showToast("تعذّر التراجع.");
  }
}

// ─── بحث ذكي: يتجاهل الهمزات والتشكيل ويطابق أي كلمة بأي مكان ──
function normalizeSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "") // التشكيل
    .replace(/ـ/g, "")                 // التطويل (ـ)
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function searchMatch(haystack, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const h = normalizeSearchText(haystack);
  return q.split(" ").every((word) => word.length === 0 || h.includes(word));
}

function savedThemePreference() {
  try {
    const theme = localStorage.getItem(APP_THEME_KEY);
    return theme === "dark" || theme === "light" ? theme : "";
  } catch (error) {
    return "";
  }
}

function defaultState() {
  return {
    selectedTable: 1,
    tableCount: DEFAULT_TABLE_COUNT,
    tableNames: {},
    theme: "light",
    lastPaymentMethod: "cash",
    lastWorkerTransactionType: WORKER_ADVANCE_TYPE,
    lastWorkerConsumptionMode: "worker_price",
    menu: normalizeMenuItems(defaultMenu),
    customers: [],
    workers: [],
    openOrders: {},
    invoices: [],
    purchases: [],
    expenses: [],
    workerConsumptions: [],
    workerTransactions: [],
    inventoryCounts: [],
    purchaseInventoryAdjustments: {},
    customerPrices: [],
    periodCloses: [],
    lowStockThreshold: 5,
    openingCash: { cash: 0, bank: 0, wallet: 0 },
    cashAdjustments: [],
    cashTransfers: [],
    ownerWithdrawals: [],
    auditLog: [],
    businessName: "دفتر المقهى",
    appPin: "",
    printSize: "a4",
    autoBackup: true,
    lastAutoBackup: "",
    supplierPayments: [],
    loyalty: { enabled: true, perShekel: 1, rewardPoints: 100, rewardValue: 10 },
    combos: []
  };
}

function normalizeOpeningCash(value) {
  // ترحيل: لو كان رقم واحد قديم، نحطه كله كاش
  if (typeof value === "number") return { cash: value, bank: 0, wallet: 0 };
  const v = value && typeof value === "object" ? value : {};
  return {
    cash: Number(v.cash || 0),
    bank: Number(v.bank || 0),
    wallet: Number(v.wallet || 0)
  };
}

function normalizeState(parsed = {}) {
  const fallback = defaultState();
  const next = {
    ...fallback,
    ...parsed,
    tableCount: Number(parsed.tableCount || DEFAULT_TABLE_COUNT),
    tableNames: parsed.tableNames || {},
    theme: savedThemePreference() || (parsed.theme === "dark" ? "dark" : "light"),
    lastPaymentMethod: paymentMethods.includes(parsed.lastPaymentMethod) ? parsed.lastPaymentMethod : "cash",
    lastWorkerTransactionType: workerTransactionTypeLabels[parsed.lastWorkerTransactionType] ? parsed.lastWorkerTransactionType : WORKER_ADVANCE_TYPE,
    lastWorkerConsumptionMode: ["worker_price", SALARY_WORKER_CONSUMPTION_TYPE, FREE_WORKER_CONSUMPTION_TYPE].includes(parsed.lastWorkerConsumptionMode) ? parsed.lastWorkerConsumptionMode : "worker_price",
    menu: normalizeMenuItems(parsed.menu?.length ? parsed.menu : defaultMenu),
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    workers: Array.isArray(parsed.workers) ? parsed.workers.map(normalizeWorker) : [],
    openOrders: parsed.openOrders || {},
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(normalizeExpense) : [],
    workerConsumptions: Array.isArray(parsed.workerConsumptions) ? parsed.workerConsumptions.map(normalizeWorkerConsumption) : [],
    workerTransactions: Array.isArray(parsed.workerTransactions) ? parsed.workerTransactions.map(normalizeWorkerTransaction) : [],
    inventoryCounts: Array.isArray(parsed.inventoryCounts) ? parsed.inventoryCounts : [],
    purchaseInventoryAdjustments: parsed.purchaseInventoryAdjustments && typeof parsed.purchaseInventoryAdjustments === "object" ? parsed.purchaseInventoryAdjustments : {},
    customerPrices: Array.isArray(parsed.customerPrices) ? parsed.customerPrices : [],
    periodCloses: Array.isArray(parsed.periodCloses) ? parsed.periodCloses : [],
    lowStockThreshold: Number.isFinite(Number(parsed.lowStockThreshold)) ? Number(parsed.lowStockThreshold) : 5,
    openingCash: normalizeOpeningCash(parsed.openingCash),
    cashAdjustments: Array.isArray(parsed.cashAdjustments) ? parsed.cashAdjustments : [],
    cashTransfers: Array.isArray(parsed.cashTransfers) ? parsed.cashTransfers.map(normalizeCashTransfer) : [],
    ownerWithdrawals: Array.isArray(parsed.ownerWithdrawals) ? parsed.ownerWithdrawals : [],
    auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog.slice(0, MAX_AUDIT_LOG) : [],
    businessName: (typeof parsed.businessName === "string" && parsed.businessName.trim()) ? parsed.businessName.trim() : "دفتر المقهى",
    appPin: typeof parsed.appPin === "string" ? parsed.appPin : "",
    printSize: ["a4", "80mm", "58mm"].includes(parsed.printSize) ? parsed.printSize : "a4",
    autoBackup: parsed.autoBackup !== false,
    lastAutoBackup: typeof parsed.lastAutoBackup === "string" ? parsed.lastAutoBackup : "",
    supplierPayments: Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : [],
    loyalty: (() => {
      const l = parsed.loyalty && typeof parsed.loyalty === "object" ? parsed.loyalty : {};
      const pos = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);
      return {
        enabled: l.enabled !== false,
        perShekel: pos(l.perShekel, 1),
        rewardPoints: pos(l.rewardPoints, 100),
        rewardValue: pos(l.rewardValue, 10)
      };
    })(),
    combos: Array.isArray(parsed.combos) ? parsed.combos.map((c) => ({
      id: c.id || uid("combo"),
      name: String(c.name || "").trim(),
      price: Math.max(Number(c.price || 0), 0),
      items: Array.isArray(c.items) ? c.items.map((ci) => ({ menuItemId: ci.menuItemId || ci.id || "", qty: Math.max(Number(ci.qty || 1), 1) })).filter((ci) => ci.menuItemId) : []
    })).filter((c) => c.name && c.price > 0 && c.items.length) : []
  };
  next.workers = reconcileWorkers(next.workers, next.workerConsumptions, next.workerTransactions);
  next.tableCount = Math.max(1, Math.floor(Number(next.tableCount || DEFAULT_TABLE_COUNT)));
  next.selectedTable = Math.min(Math.max(Number(next.selectedTable || 1), 1), next.tableCount);
  rebuildCustomerAccountsFromInvoices(next);
  workerConsumptionMode = next.lastWorkerConsumptionMode;
  return next;
}

function isLedgerCashCustomerName(name) {
  const cleaned = String(name || "").trim();
  return !cleaned || cleaned === "زبون نقدي";
}

function invoiceIsCancelled(invoice = {}) {
  return invoice.type === "cancelled" || invoice.status === "cancelled" || Boolean(invoice.cancelledAt);
}

function invoiceAccountDelta(invoice = {}) {
  if (invoiceIsCancelled(invoice)) return 0;
  const delta = Number(invoice.delta);
  if (Number.isFinite(delta)) return delta;
  if (invoice.type === "payment") return -(Number(invoice.paid || 0) + Number(invoice.discount || 0));
  if (invoice.type === "payout") return Number(invoice.paid || 0);
  if (invoice.type === "debt") return Number(invoice.total || 0);
  return Number(invoice.total || 0) - Number(invoice.paid || 0);
}

function findCustomerForInvoice(data, invoice) {
  const customers = Array.isArray(data.customers) ? data.customers : [];
  if (invoice.customerId) {
    const byId = customers.find((customer) => customer.id === invoice.customerId);
    if (byId) return byId;
  }
  const name = String(invoice.customerName || "").trim();
  return name ? customers.find((customer) => String(customer.name || "").trim() === name) || null : null;
}

function ensureInvoiceCustomer(data, invoice) {
  if (isLedgerCashCustomerName(invoice.customerName) && !invoice.customerId) return null;
  data.customers = Array.isArray(data.customers) ? data.customers : [];

  let customer = findCustomerForInvoice(data, invoice);
  if (customer) return customer;

  const name = String(invoice.customerName || "").trim();
  if (!name || isLedgerCashCustomerName(name)) return null;

  customer = {
    id: invoice.customerId || uid("customer"),
    name,
    phone: "",
    balance: 0,
    totalBilled: 0,
    totalPaid: 0,
    createdAt: invoice.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.customers.unshift(customer);
  return customer;
}

function rebuildCustomerAccountsFromInvoices(data = state) {
  if (!data || !Array.isArray(data.invoices)) return data;
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  const touched = new Set();

  data.invoices.forEach((invoice) => {
    if (!invoice || typeof invoice !== "object") return;
    const customer = ensureInvoiceCustomer(data, invoice);
    if (!customer) return;

    if (!touched.has(customer.id)) {
      customer.balance = 0;
      customer.totalBilled = 0;
      customer.totalPaid = 0;
      touched.add(customer.id);
    }

    invoice.customerId = customer.id;
    invoice.customerName = customer.name;
    if (invoiceIsCancelled(invoice)) {
      customer.updatedAt = new Date().toISOString();
      return;
    }
    customer.totalBilled += Number(invoice.total || 0);
    customer.totalPaid += invoice.type === "payout" ? -Number(invoice.paid || 0) : Number(invoice.paid || 0);
    customer.balance += invoiceAccountDelta(invoice);
    customer.updatedAt = new Date().toISOString();
  });

  data.customers.forEach((customer) => {
    if (!touched.has(customer.id)) return;
    customer.totalBilled = Math.max(0, Number(customer.totalBilled || 0));
    customer.totalPaid = Math.max(0, Number(customer.totalPaid || 0));
    customer.balance = Number(customer.balance || 0);
  });

  return data;
}

function sanitizedAuditDetails(details) {
  try {
    const json = JSON.stringify(details || {});
    if (json.length <= 8000) return JSON.parse(json);
    return { truncated: true, preview: json.slice(0, 8000) };
  } catch (error) {
    return { note: "تعذر حفظ تفاصيل العملية" };
  }
}

function auditAction(action, details = {}) {
  if (!state) return;
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.auditLog.unshift({
    id: typeof uid === "function" ? uid("audit") : `audit-${Date.now()}`,
    action,
    details: sanitizedAuditDetails(details),
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(0, MAX_AUDIT_LOG);
}

function customerAccountExpectations(data = state) {
  const result = new Map();
  if (!data || !Array.isArray(data.invoices)) return result;

  data.invoices.forEach((invoice) => {
    if (!invoice || (isLedgerCashCustomerName(invoice.customerName) && !invoice.customerId)) return;
    if (invoiceIsCancelled(invoice)) return;
    const key = invoice.customerId || String(invoice.customerName || "").trim();
    if (!key) return;
    const row = result.get(key) || {
      name: invoice.customerName || "",
      totalBilled: 0,
      totalPaid: 0,
      balance: 0
    };
    row.totalBilled += Number(invoice.total || 0);
    row.totalPaid += invoice.type === "payout" ? -Number(invoice.paid || 0) : Number(invoice.paid || 0);
    row.balance += invoiceAccountDelta(invoice);
    result.set(key, row);
  });

  return result;
}

function dataHealthReport(data = state) {
  const issues = [];
  const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
  const customers = Array.isArray(data?.customers) ? data.customers : [];
  const closes = Array.isArray(data?.periodCloses) ? data.periodCloses : [];
  const invoiceKeys = new Set();
  let duplicateInvoices = 0;
  let invalidDates = 0;

  invoices.forEach((invoice) => {
    const key = `${invoice.number || ""}__${invoice.createdAt || ""}`;
    if (invoiceKeys.has(key)) duplicateInvoices += 1;
    invoiceKeys.add(key);
    if (Number.isNaN(new Date(invoice.createdAt).getTime())) invalidDates += 1;
  });

  if (duplicateInvoices) issues.push(`فواتير مكررة: ${duplicateInvoices}`);
  if (invalidDates) issues.push(`تواريخ فواتير غير صحيحة: ${invalidDates}`);

  let overlappingCloses = 0;
  for (let i = 0; i < closes.length; i += 1) {
    for (let j = i + 1; j < closes.length; j += 1) {
      if (closes[i].from <= closes[j].to && closes[i].to >= closes[j].from) overlappingCloses += 1;
    }
  }
  if (overlappingCloses) issues.push(`إغلاقات متداخلة: ${overlappingCloses}`);

  const expectations = customerAccountExpectations(data);
  let customerMismatches = 0;
  customers.forEach((customer) => {
    const expected = expectations.get(customer.id) || expectations.get(String(customer.name || "").trim());
    if (!expected) return;
    const balanceDiff = Math.abs(Number(customer.balance || 0) - Number(expected.balance || 0));
    const billedDiff = Math.abs(Number(customer.totalBilled || 0) - Number(expected.totalBilled || 0));
    const paidDiff = Math.abs(Number(customer.totalPaid || 0) - Math.max(0, Number(expected.totalPaid || 0)));
    if (balanceDiff > 0.01 || billedDiff > 0.01 || paidDiff > 0.01) customerMismatches += 1;
  });
  if (customerMismatches) issues.push(`أرصدة عملاء تحتاج مزامنة: ${customerMismatches}`);

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      invoices: invoices.length,
      customers: customers.length,
      auditLog: Array.isArray(data?.auditLog) ? data.auditLog.length : 0,
      backups: Number(data?.lastAutoBackup ? 1 : 0)
    }
  };
}

function parseBackupSnapshot(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.payload ? JSON.parse(parsed.payload) : parsed;
}

function loadLocalBackupState() {
  try {
    const autoBackup = parseBackupSnapshot(localStorage.getItem(AUTO_BACKUP_KEY));
    if (autoBackup) return normalizeState(autoBackup);

    const history = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    const latest = Array.isArray(history) ? history.find((entry) => entry?.payload) : null;
    return latest ? normalizeState(JSON.parse(latest.payload)) : null;
  } catch (error) {
    console.warn("Could not load backup data", error);
    return null;
  }
}

function localBackupSnapshots() {
  try {
    const snapshots = [];
    const pushSnapshot = (entry) => {
      if (!entry || typeof entry !== "object" || !entry.payload) return;
      snapshots.push(entry);
    };

    pushSnapshot(JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || "null"));
    const history = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    if (Array.isArray(history)) history.forEach(pushSnapshot);

    const seen = new Set();
    return snapshots
      .filter((snapshot) => {
        const key = `${snapshot.createdAt || ""}__${String(snapshot.payload || "").length}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (error) {
    console.warn("Could not read local backup snapshots", error);
    return [];
  }
}

function latestLocalBackupSnapshot() {
  return localBackupSnapshots()[0] || null;
}

function snapshotState(snapshot) {
  if (!snapshot?.payload) return null;
  try {
    return normalizeState(JSON.parse(snapshot.payload));
  } catch (error) {
    return null;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const backup = loadLocalBackupState();
      if (backup) return backup;
      stateNeedsBackupRecovery = true;
      return defaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load saved data", error);
    const backup = loadLocalBackupState();
    if (backup) return backup;
    stateNeedsBackupRecovery = true;
    return defaultState();
  }
}

let localBackupTimer = null;
let pendingSerialized = null;
let lastSavedSerialized = null;

function saveState(immediate) {
  const serialized = JSON.stringify(state);
  if (serialized === lastSavedSerialized) {
    if (immediate === true && pendingSerialized) flushBackups();
    return;
  }
  // الحفظ الرئيسي فوري دائمًا (يضمن عدم ضياع البيانات).
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    lastSavedSerialized = serialized;
  } catch (error) {
    console.warn("Could not save browser storage", error);
  }
  // النسخ الاحتياطية (سجل + IndexedDB) ثقيلة، فتُؤجَّل حتى لا تبطّئ كل ضغطة مفتاح.
  pendingSerialized = serialized;
  if (immediate === true) {
    flushBackups();
    return;
  }
  clearTimeout(localBackupTimer);
  localBackupTimer = setTimeout(flushBackups, 1500);
}

function flushBackups() {
  clearTimeout(localBackupTimer);
  const serialized = pendingSerialized;
  if (!serialized) return;
  pendingSerialized = null;
  try {
    saveLocalBackup(serialized);
  } catch (error) {
    console.warn("Could not save local backup", error);
  }
  if (!stateNeedsBackupRecovery || businessRecordCount(state) > 0) {
    queueDurableBackup(serialized);
  }
}

function businessRecordCount(data = state) {
  const openOrderCount = Object.values(data.openOrders || {}).filter((order) => order.items?.length).length;
  return Number(data.customers?.length || 0)
    + Number(data.workers?.length || 0)
    + Number(data.invoices?.length || 0)
    + Number(data.purchases?.length || 0)
    + Number(data.workerConsumptions?.length || 0)
    + Number(data.workerTransactions?.length || 0)
    + Number(data.inventoryCounts?.length || 0)
    + openOrderCount;
}

function backupSnapshot(serialized) {
  return {
    createdAt: new Date().toISOString(),
    payload: serialized,
    recordCount: businessRecordCount(state)
  };
}

function saveLocalBackup(serialized) {
  try {
    const snapshot = backupSnapshot(serialized);
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));

    const history = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    const nextHistory = Array.isArray(history) ? history : [];
    const last = nextHistory[0];
    const lastTime = last?.createdAt ? new Date(last.createdAt).getTime() : 0;
    const now = new Date(snapshot.createdAt).getTime();

    if (!last || last.payload !== serialized) {
      if (now - lastTime < 10 * 60 * 1000) nextHistory[0] = snapshot;
      else nextHistory.unshift(snapshot);
    }

    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, MAX_BACKUP_HISTORY)));
  } catch (error) {
    console.warn("Could not save local backup", error);
  }
}

function openBackupDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        database.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeDurableBackup(snapshot) {
  const database = await openBackupDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(BACKUP_STORE_NAME);
    store.put({ id: "latest", ...snapshot });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function queueDurableBackup(serialized) {
  clearTimeout(backupWriteTimer);
  backupWriteTimer = setTimeout(() => {
    writeDurableBackup(backupSnapshot(serialized)).catch((error) => {
      console.warn("Could not save durable backup", error);
    });
  }, 250);
}

async function readDurableBackup() {
  const database = await openBackupDatabase();
  const snapshot = await new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readonly");
    const request = transaction.objectStore(BACKUP_STORE_NAME).get("latest");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return snapshot;
}

async function recoverFromDurableBackup() {
  if (!stateNeedsBackupRecovery) return;

  try {
    const snapshot = await readDurableBackup();
    if (!snapshot?.payload) {
      stateNeedsBackupRecovery = false;
      return;
    }

    const recoveredState = normalizeState(JSON.parse(snapshot.payload));
    if (businessRecordCount(recoveredState) <= businessRecordCount(state)) {
      stateNeedsBackupRecovery = false;
      return;
    }

    state = recoveredState;
    stateNeedsBackupRecovery = false;
    selectedCustomerId = state.customers[0]?.id || null;
    selectedWorkerId = state.workers[0]?.id || null;
    lastClosedInvoice = state.invoices[0] || null;
    setLastPaymentMethod(getLastPaymentMethod());
    showToast("تم استعادة بياناتك من نسخة احتياطية تلقائياً.");
    render();
  } catch (error) {
    stateNeedsBackupRecovery = false;
    console.warn("Could not recover durable backup", error);
  }
}
