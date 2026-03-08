-- CreateTable
CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
