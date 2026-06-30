// Bundled fixtures — served when INTRIX_API_KEY is empty (mock mode). This is
// the ultimate workshop fallback: the module always works, key or not.
export type Contact = {
  id: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
};

export const MOCK_CONTACTS: Contact[] = [
  { id: "c-001", name: "Ana Novak", email: "ana@acme.si", company: "Acme d.o.o.", phone: "+386 1 234 5678" },
  { id: "c-002", name: "Marko Horvat", email: "marko@brio.si", company: "Brio", phone: "+386 1 222 3333" },
  { id: "c-003", name: "Eva Kos", email: "eva@delfin.si", company: "Delfin", phone: "+386 1 555 6666" },
];
