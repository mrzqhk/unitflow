/**
 * i18n.ts — English / Malayalam translation strings.
 *
 * Keep it simple: a flat object keyed by translation ID.
 * Add more keys as new screens are built.
 */

import { Language } from "./types";

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Auth
    "auth.login":             "Login",
    "auth.username":          "Username",
    "auth.password":          "Password",
    "auth.sign_in":           "Sign In",
    "auth.signing_in":        "Signing in…",
    "auth.welcome_back":      "Welcome back",
    "auth.tagline":           "Manufacturing Management System",
    "auth.create_owner":      "Create Owner Account",
    "auth.create_owner_desc": "Set up your administrator account to get started.",
    "auth.full_name":         "Full Name",
    "auth.create_account":    "Create Account",
    "auth.creating":          "Creating…",

    // Navigation
    "nav.dashboard":  "Dashboard",
    "nav.customers":  "Customers",
    "nav.products":   "Products",
    "nav.sales":      "Sales",
    "nav.design":     "Design",
    "nav.production": "Production",
    "nav.store":      "Store",
    "nav.delivery":   "Delivery",
    "nav.accounts":   "Accounts",
    "nav.users":      "User Management",
    "nav.logout":     "Logout",

    // Dashboard
    "dashboard.welcome":    "Welcome",
    "dashboard.role_label": "Role",
    "dashboard.subtitle":   "Here's an overview of your manufacturing workspace.",

    // Users
    "users.title":         "User Management",
    "users.add_user":      "Add User",
    "users.name":          "Name",
    "users.username":      "Username",
    "users.role":          "Role",
    "users.status":        "Status",
    "users.active":        "Active",
    "users.inactive":      "Inactive",
    "users.edit":          "Edit",
    "users.save":          "Save",
    "users.cancel":        "Cancel",
    "users.new_password":  "New Password (leave blank to keep current)",
    "users.create_title":  "Create New User",
    "users.edit_title":    "Edit User",

    // Customers
    "customers.title":              "Customers",
    "customers.subtitle":           "Manage customer accounts, retail/wholesale profiles and credit limits",
    "customers.add":                "Add Customer",
    "customers.edit":               "Edit Customer",
    "customers.search_placeholder": "Search by customer name, company or phone...",
    "customers.name":               "Customer Name",
    "customers.company":            "Company Name",
    "customers.phone":              "Phone Number",
    "customers.alternate_phone":    "Alternate Phone",
    "customers.email":              "Email Address",
    "customers.billing_address":    "Billing Address",
    "customers.delivery_address":   "Delivery Address",
    "customers.same_as_billing":    "Same as billing address",
    "customers.gst":                "GST Number",
    "customers.type":               "Customer Type",
    "customers.retail":             "Retail",
    "customers.wholesale":          "Wholesale",
    "customers.credit_limit":       "Credit Limit (₹)",
    "customers.notes":              "Internal Notes",
    "customers.status":             "Status",
    "customers.active":             "Active",
    "customers.inactive":           "Inactive",
    "customers.disable":            "Disable Customer",
    "customers.enable":             "Enable Customer",
    "customers.view_details":       "View Details",
    "customers.back_to_list":       "Back to Customers",
    "customers.details_tab":        "Profile & Details",
    "customers.quotations_tab":     "Quotations",
    "customers.orders_tab":         "Orders",
    "customers.payments_tab":       "Payments & Ledger",
    "customers.phone_warning":      "Warning: A customer with this phone number already exists:",
    "customers.phone_required":     "Valid phone number is required",
    "customers.name_required":      "Customer name is required",
    "customers.empty_quotations":   "No quotations recorded for this customer yet.",
    "customers.empty_orders":       "No orders placed by this customer yet.",
    "customers.empty_payments":     "No ledger transactions or payments recorded yet.",

    // Products
    "products.title":              "Products & Pricing",
    "products.subtitle":           "Manage item master, base prices and tiered wholesale slabs",
    "products.add":                "Add Product",
    "products.edit":               "Edit Product",
    "products.search_placeholder": "Search products by name or category...",
    "products.name":               "Product Name",
    "products.category":           "Category",
    "products.unit":               "Unit of Measure",
    "products.retail_price":       "Retail Price (₹)",
    "products.wholesale_price":    "Wholesale Base Price (₹)",
    "products.slabs_title":        "Tiered Wholesale Slabs",
    "products.slabs_desc":         "Higher purchase quantities automatically unlock lower wholesale prices",
    "products.min_qty":            "Min Quantity",
    "products.slab_price":         "Slab Price (₹)",
    "products.add_slab":           "Add Quantity Slab",
    "products.price_owner_only":   "Price fields are locked. Only the owner can configure product prices.",
    "products.disable":            "Disable Product",
    "products.enable":             "Enable Product",
    "products.no_slabs":           "No tiered slabs defined. Standard wholesale price applies.",

    // Backup
    "backup.button":  "Backup Database Now",
    "backup.success": "Backup created successfully.",
    "backup.fail":    "Backup failed.",
    "backup.last":    "Last backup",

    // General
    "general.save":        "Save",
    "general.cancel":      "Cancel",
    "general.close":       "Close",
    "general.loading":     "Loading…",
    "general.error":       "An error occurred.",
    "general.actions":     "Actions",
    "general.all":         "All",
    "general.filter":      "Filter",
    "general.created_by":  "Created by",
    "general.updated_by":  "Updated by",
    "general.created_at":  "Created at",
    "general.updated_at":  "Last updated",

    // Roles
    "role.owner":      "Owner",
    "role.sales":      "Sales",
    "role.designer":   "Designer",
    "role.supervisor": "Supervisor",
    "role.worker":     "Worker",
    "role.store":      "Store",
    "role.delivery":   "Delivery",
    "role.accountant": "Accountant",
  },

  ml: {
    // Auth
    "auth.login":             "ലോഗിൻ",
    "auth.username":          "ഉപയോക്തൃ നാമം",
    "auth.password":          "പാസ്‌വേഡ്",
    "auth.sign_in":           "സൈൻ ഇൻ",
    "auth.signing_in":        "സൈൻ ഇൻ ചെയ്യുന്നു…",
    "auth.welcome_back":      "സ്വാഗതം",
    "auth.tagline":           "നിർമ്മാണ മാനേജ്മെന്റ് സിസ്റ്റം",
    "auth.create_owner":      "ഉടമ അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    "auth.create_owner_desc": "ആരംഭിക്കാൻ അഡ്മിനിസ്ട്രേറ്റർ അക്കൗണ്ട് സജ്ജമാക്കുക.",
    "auth.full_name":         "പൂർണ്ണ പേര്",
    "auth.create_account":    "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    "auth.creating":          "സൃഷ്ടിക്കുന്നു…",

    // Navigation
    "nav.dashboard":  "ഡാഷ്ബോർഡ്",
    "nav.customers":  "ഉപഭോക്താക്കൾ",
    "nav.products":   "ഉൽപ്പന്നങ്ങൾ",
    "nav.sales":      "വിൽപ്പന",
    "nav.design":     "ഡിസൈൻ",
    "nav.production": "ഉൽപ്പാദനം",
    "nav.store":      "സ്‌റ്റോർ",
    "nav.delivery":   "ഡെലിവറി",
    "nav.accounts":   "അക്കൗണ്ടുകൾ",
    "nav.users":      "ഉപയോക്താക്കൾ",
    "nav.logout":     "ലോഗൗട്ട്",

    // Dashboard
    "dashboard.welcome":    "സ്വാഗതം",
    "dashboard.role_label": "റോൾ",
    "dashboard.subtitle":   "നിങ്ങളുടെ വർക്ക്‌സ്‌പേസ് ഒരു നോക്ക്.",

    // Users
    "users.title":         "ഉപയോക്തൃ മാനേജ്മെന്റ്",
    "users.add_user":      "ഉപയോക്താവിനെ ചേർക്കുക",
    "users.name":          "പേര്",
    "users.username":      "ഉപയോക്തൃ നാമം",
    "users.role":          "റോൾ",
    "users.status":        "നില",
    "users.active":        "സജീവം",
    "users.inactive":      "നിഷ്‌ക്രിയം",
    "users.edit":          "തിരുത്തുക",
    "users.save":          "സംരക്ഷിക്കുക",
    "users.cancel":        "റദ്ദാക്കുക",
    "users.new_password":  "പുതിയ പാസ്‌വേഡ് (ശൂന്യമാക്കിയാൽ മാറ്റില്ല)",
    "users.create_title":  "പുതിയ ഉപയോക്താവ്",
    "users.edit_title":    "ഉപയോക്താവ് തിരുത്തുക",

    // Customers
    "customers.title":              "ഉപഭോക്താക്കൾ",
    "customers.subtitle":           "ഉപഭോക്താക്കൾ, റീട്ടെയിൽ/ഹോൾസെയിൽ പ്രൊഫൈലുകൾ, ക്രെഡിറ്റ് പരിധികൾ കൈകാര്യം ചെയ്യുക",
    "customers.add":                "ഉപഭോക്താവിനെ ചേർക്കുക",
    "customers.edit":               "ഉപഭോക്താവ് തിരുത്തുക",
    "customers.search_placeholder": "പേര്, കമ്പനി, അല്ലെങ്കിൽ ഫോൺ നമ്പർ തിരയുക...",
    "customers.name":               "ഉപഭോക്താവിന്റെ പേര്",
    "customers.company":            "കമ്പനി പേര്",
    "customers.phone":              "ഫോൺ നമ്പർ",
    "customers.alternate_phone":    "മറ്റൊരു ഫോൺ നമ്പർ",
    "customers.email":              "ഇമെയിൽ വിലാസം",
    "customers.billing_address":    "ബില്ലിംഗ് വിലാസം",
    "customers.delivery_address":   "ഡെലിവറി വിലാസം",
    "customers.same_as_billing":    "ബില്ലിംഗ് വിലാസം പോലെ",
    "customers.gst":                "ജിഎസ്ടി നമ്പർ",
    "customers.type":               "ഉപഭോക്തൃ തരം",
    "customers.retail":             "റീട്ടെയിൽ",
    "customers.wholesale":          "ഹോൾസെയിൽ",
    "customers.credit_limit":       "ക്രെഡിറ്റ് പരിധി (₹)",
    "customers.notes":              "കുറിപ്പുകൾ",
    "customers.status":             "നില",
    "customers.active":             "സജീവം",
    "customers.inactive":           "നിഷ്‌ക്രിയം",
    "customers.disable":            "നിഷ്‌ക്രിയമാക്കുക",
    "customers.enable":             "സജീവമാക്കുക",
    "customers.view_details":       "വിശദാംശങ്ങൾ കാണുക",
    "customers.back_to_list":       "ഉപഭോക്താക്കളുടെ പട്ടിക",
    "customers.details_tab":        "പ്രൊഫൈൽ വിശദാംശങ്ങൾ",
    "customers.quotations_tab":     "കൊട്ടേഷനുകൾ",
    "customers.orders_tab":         "ഓർഡറുകൾ",
    "customers.payments_tab":       "പേയ്‌മെന്റുകൾ & ലെഡ്ജർ",
    "customers.phone_warning":      "മുന്നറിയിപ്പ്: ഈ ഫോൺ നമ്പർ ഇതിനകം രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്:",
    "customers.phone_required":     "സാധുവായ ഫോൺ നമ്പർ ആവശ്യമാണ്",
    "customers.name_required":      "ഉപഭോക്താവിന്റെ പേര് ആവശ്യമാണ്",
    "customers.empty_quotations":   "ഈ ഉപഭോക്താവിന് ഇതുവരെ കൊട്ടേഷനുകൾ ഇല്ല.",
    "customers.empty_orders":       "ഈ ഉപഭോക്താവിന് ഇതുവരെ ഓർഡറുകൾ ഇല്ല.",
    "customers.empty_payments":     "ഇതുവരെ പേയ്‌മെന്റ് രേഖകളില്ല.",

    // Products
    "products.title":              "ഉൽപ്പന്നങ്ങളും വിലയും",
    "products.subtitle":           "ഉൽപ്പന്നങ്ങളുടെ പട്ടിക, അടിസ്ഥാന വിലകൾ, അളവ് സ്ലാബുകൾ",
    "products.add":                "ഉൽപ്പന്നം ചേർക്കുക",
    "products.edit":               "ഉൽപ്പന്നം തിരുത്തുക",
    "products.search_placeholder": "പേരോ കാറ്റഗറിയോ ഉപയോഗിച്ച് തിരയുക...",
    "products.name":               "ഉൽപ്പന്നത്തിന്റെ പേര്",
    "products.category":           "കാറ്റഗറി",
    "products.unit":               "യൂണിറ്റ്",
    "products.retail_price":       "റീട്ടെയിൽ വില (₹)",
    "products.wholesale_price":    "ഹോൾസെയിൽ വില (₹)",
    "products.slabs_title":        "ഹോൾസെയിൽ അളവ് സ്ലാബുകൾ",
    "products.slabs_desc":         "കൂടുതൽ അളവ് വാങ്ങുമ്പോൾ കുറഞ്ഞ ഹോൾസെയിൽ വില ലഭ്യമാകും",
    "products.min_qty":            "കുറഞ്ഞ അളവ്",
    "products.slab_price":         "സ്ലാബ് വില (₹)",
    "products.add_slab":           "സ്ലാബ് ചേർക്കുക",
    "products.price_owner_only":   "വില മാറ്റാൻ ഉടമയ്ക്ക് മാത്രമേ സാധിക്കൂ.",
    "products.disable":            "നിഷ്‌ക്രിയമാക്കുക",
    "products.enable":             "സജീവമാക്കുക",
    "products.no_slabs":           "പ്രത്യേക സ്ലാബുകൾ ഇല്ല. അടിസ്ഥാന ഹോൾസെയിൽ വില ബാധകം.",

    // Backup
    "backup.button":  "ഇപ്പോൾ ബാക്കപ്പ്",
    "backup.success": "ബാക്കപ്പ് വിജയകരമായി.",
    "backup.fail":    "ബാക്കപ്പ് പരാജയപ്പെട്ടു.",
    "backup.last":    "അവസാന ബാക്കപ്പ്",

    // General
    "general.save":        "സംരക്ഷിക്കുക",
    "general.cancel":      "റദ്ദാക്കുക",
    "general.close":       "അടയ്ക്കുക",
    "general.loading":     "ലോഡ് ചെയ്യുന്നു…",
    "general.error":       "ഒരു പിശക് സംഭവിച്ചു.",
    "general.actions":     "നടപടികൾ",
    "general.all":         "എല്ലാം",
    "general.filter":      "ഫിൽട്ടർ",
    "general.created_by":  "സൃഷ്ടിച്ചത്",
    "general.updated_by":  "അവസാനം മാറ്റിയത്",
    "general.created_at":  "സൃഷ്ടിച്ച തീയതി",
    "general.updated_at":  "മാറ്റിയ തീയതി",

    // Roles
    "role.owner":      "ഉടമ",
    "role.sales":      "വിൽപ്പന",
    "role.designer":   "ഡിസൈനർ",
    "role.supervisor": "സൂപ്പർവൈസർ",
    "role.worker":     "തൊഴിലാളി",
    "role.store":      "സ്‌റ്റോർ",
    "role.delivery":   "ഡെലിവറി",
    "role.accountant": "അക്കൗണ്ടന്റ്",
  },
};

/**
 * Returns a translation function for the given language.
 * Usage: const t = useT(); t("auth.login")
 */
export function getT(lang: Language) {
  return (key: string): string =>
    translations[lang][key] ?? translations.en[key] ?? key;
}

export default translations;
