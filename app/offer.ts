import offerData from '../config/reader-offer.json';

/** A public product definition, not a payment credential or purchase receipt. */
export const readerOffer = offerData;
const freeIds = new Set<string>(readerOffer.freeBookIds);
export const isFreeBook = (bookId:string) => freeIds.has(bookId);
export const freeBookCount = freeIds.size;
export const premiumPriceTwd = readerOffer.premium.priceTwd;

/**
 * A paid entitlement must ultimately be verified by a trusted server that
 * protects non-public manuscripts. Never use localStorage, URL flags, or
 * client-only "purchase" data to grant premium access.
 *
 * Until the merchant payment account, webhook confirmation, account linking,
 * refund handling, and private content hosting are configured, sales fail
 * closed and existing readers keep their free unlocks.
 */
export const paidCheckoutIsLive = false;
export const transitionalFreeUnlock = readerOffer.transitionalAccess.legacyFreeUnlock;
