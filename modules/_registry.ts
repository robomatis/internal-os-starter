// The module registry. Code here owns: id → component, icon, and the DEFAULT
// name/description. The DB (core_modules) owns the live label, the enabled flag,
// and the launcher order — all editable by owners in Admin. Keep ids in sync
// with the core_modules rows.
// Adding a module: add an entry here, a core_modules row, the modules/<id>/
// folder, and a case in app/m/[module]/page.tsx. Use /scaffold-module.
export type ModuleDef = {
  id: string; // lowercase snake_case — also the database table prefix
  name: string;
  description: string;
  icon: string; // emoji, shown on the launcher
};

export const MODULES: ModuleDef[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Manage which users can see which modules.",
    icon: "⚙️",
  },
  {
    id: "crm_demo",
    name: "CRM (demo)",
    description: "Contacts pulled from Intrix — read-only.",
    icon: "📇",
  },
  {
    id: "ai_assist",
    name: "AI Assistant",
    description: "Ask a question; AI answers and the Q&A is saved.",
    icon: "🤖",
  },
  {
    id: "invoice_ocr",
    name: "Likvidacija računov",
    description: "Naloži račun → AI prebere (OCR) → potrdi/zavrni → izvozi CSV.",
    icon: "🧾",
  },
];

export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
