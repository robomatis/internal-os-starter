// Per-module config. Mirrors the registry entry; modules read their own config,
// never another module's.
export const config = {
  id: "invoice_ocr",
  name: "Likvidacija računov",
  description:
    "Naloži račun (slika ali PDF), AI prebere podatke (OCR), ti pa jih potrdiš za plačilo in izvoziš v CSV.",
};
