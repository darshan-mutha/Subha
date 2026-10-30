import { whatsappLink } from "@/lib/team";

/** wa.me needs digits with country code; 10-digit Indian numbers get +91. */
export function vendorWhatsApp(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : "";
  const url = new URL(whatsappLink(text));
  url.pathname = `/${number}`;
  return url.href;
}

/** Prints only the agreement box, then restores the page after printing. */
export function printAgreement(id: string) {
  const body = document.body;
  body.dataset.print = "agreement";
  document.getElementById(id)?.classList.add("print-this");
  const done = () => {
    delete body.dataset.print;
    document.getElementById(id)?.classList.remove("print-this");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
