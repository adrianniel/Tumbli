/**
 * Where "Send feedback" emails go. It's shown to users and lives in the public
 * app, so use an address made for support, not a personal one.
 * Also listed as the support contact in STORE_LISTING.md.
 */
export const SUPPORT_EMAIL = "adrianniel.garig@gmail.com";

/**
 * Tumbli's Store ID from Partner Center (Product identity > Store ID, e.g. 9NBLGGH4R32N).
 * Used by the "Rate Tumbli" prompt. While empty, the prompt opens a Store search instead.
 */
export const STORE_PRODUCT_ID = "9N6798TPR3KX";

export const storeReviewUrl = () =>
  STORE_PRODUCT_ID
    ? `ms-windows-store://review/?ProductId=${STORE_PRODUCT_ID}`
    : "ms-windows-store://search/?query=Tumbli";
