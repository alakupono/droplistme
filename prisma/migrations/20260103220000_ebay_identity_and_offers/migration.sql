-- Add eBay identity fields to stores
ALTER TABLE "stores" ADD COLUMN "ebay_user_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "ebay_username" TEXT;

-- Add eBay offer fields to listings (Sell Inventory API)
ALTER TABLE "listings" ADD COLUMN "ebay_offer_id" TEXT;
ALTER TABLE "listings" ADD COLUMN "sku" TEXT;
ALTER TABLE "listings" ADD COLUMN "marketplace_id" TEXT;

-- Unique index for eBay offer id (multiple NULLs allowed in Postgres)
CREATE UNIQUE INDEX "listings_ebay_offer_id_key" ON "listings"("ebay_offer_id");


