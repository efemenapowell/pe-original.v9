/* ============================================================
   PE_ORIGINALS — js/store-config.js
   Public store details shown at checkout. Nothing secret here —
   this is exactly what a customer needs to pay you directly.
   Edit these three values whenever your bank details or WhatsApp
   number change; no backend deploy needed.
   ============================================================ */
window.PEO_STORE = {
  bank: {
    bankName: "Zenith Bank",
    accountNumber: "2209478372",
    accountName: "Onome Precious",
  },
  // Include the country code, no leading zero, no spaces or dashes
  // (Nigerian mobile numbers: drop the leading 0, prefix 234).
  whatsappNumber: "2347025366051",
  // WhatsApp Business "scan to chat" short link (from the account's QR
  // code). Used instead of whatsappNumber when set — works the same way
  // but goes through the verified WhatsApp Business Account.
  whatsappLink: "https://wa.me/message/7UEI5JSWWITDA1",
};
