import type { BankDetails, PaymentProvider } from "./types.ts";

/**
 * Manual activation — bank transfer (firms, government entities) or any deal
 * the DEAL team closes by hand. Checkout only records the pending request and
 * shows transfer instructions; the server function alerts the team, and a
 * team member marks it paid in /admin/law after the money arrives.
 *
 * Bank details come from the environment so no account number lives in code:
 * LAW_BANK_NAME, LAW_BANK_BENEFICIARY, LAW_BANK_IBAN. Unset -> the page says
 * the team will send the details (never an invented IBAN).
 */
export function bankDetails(): BankDetails | null {
  const v = (k: string) => process.env[k]?.trim() || null;
  const details = {
    bankName: v("LAW_BANK_NAME"),
    beneficiary: v("LAW_BANK_BENEFICIARY"),
    iban: v("LAW_BANK_IBAN"),
  };
  return details.iban ? details : null;
}

export const manualProvider: PaymentProvider = {
  id: "manual",
  label: "تحويل بنكي / تفعيل من فريق ديل",
  enabled: () => true,
  async checkout() {
    return { kind: "instructions", bank: bankDetails() };
  },
  async verify() {
    // Only a DEAL team member confirms a transfer (console: "mark paid").
    return "pending";
  },
};
