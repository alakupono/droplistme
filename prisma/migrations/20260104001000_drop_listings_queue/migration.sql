-- CreateTable
CREATE TABLE "drop_listings" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "images" TEXT[],
    "title" TEXT,
    "description" TEXT,
    "category_id" TEXT,
    "condition" TEXT,
    "price" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sku" TEXT,
    "marketplace_id" TEXT,
    "ai_extracted_text" TEXT,
    "ai_raw" JSONB,
    "ai_notes" TEXT[],
    "error" TEXT,
    "published_listing_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drop_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drop_listings_published_listing_id_key" ON "drop_listings"("published_listing_id");

-- AddForeignKey
ALTER TABLE "drop_listings" ADD CONSTRAINT "drop_listings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_listings" ADD CONSTRAINT "drop_listings_published_listing_id_fkey" FOREIGN KEY ("published_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


