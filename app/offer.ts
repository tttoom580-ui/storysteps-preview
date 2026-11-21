import offerData from '../config/reader-offer.json';

/** A public product definition, not a payment credential or purchase receipt. */
export const readerOffer = offerData;
const freeIds = new Set<string>(readerOffer.freeBookIds);
export const isFreeBook = (bookId:string) => freeIds.has(bookId);
const previewOnlyIds = new Set<string>(readerOffer.freeAccess.previewOnlyBookIds);
export const isFullFreeBook = (bookId:string) => freeIds.has(bookId) && !previewOnlyIds.has(bookId);
export const freeAccessLabel = (bookId:string) => isFullFreeBook(bookId) ? '25 章完整免費' : `前 ${previewChapters} 章免費`;
export const fullFreeBookCount = readerOffer.freeBookIds.length - previewOnlyIds.size;
export const previewChapters = readerOffer.previewChapters;
export const freeBookCount = freeIds.size;
export const premiumPriceTwd = readerOffer.premium.priceTwd;
