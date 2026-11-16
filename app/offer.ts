import offerData from '../config/reader-offer.json';

/** A public product definition, not a payment credential or purchase receipt. */
export const readerOffer = offerData;
const freeIds = new Set<string>(readerOffer.freeBookIds);
export const isFreeBook = (bookId:string) => freeIds.has(bookId);
export const previewChapters = readerOffer.previewChapters;
export const freeBookCount = freeIds.size;
export const premiumPriceTwd = readerOffer.premium.priceTwd;
