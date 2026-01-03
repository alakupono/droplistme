-- Add listing-creation prerequisites to stores (policies + inventory location + marketplace)
ALTER TABLE "stores" ADD COLUMN "marketplace_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "merchant_location_key" TEXT;
ALTER TABLE "stores" ADD COLUMN "payment_policy_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "fulfillment_policy_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "return_policy_id" TEXT;

-- Store publish result identifiers on listings
ALTER TABLE "listings" ADD COLUMN "ebay_listing_id" TEXT;

-- Unique index for eBay listing id (multiple NULLs allowed in Postgres)
CREATE UNIQUE INDEX "listings_ebay_listing_id_key" ON "listings"("ebay_listing_id");


