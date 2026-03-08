-- CreateTable
CREATE TABLE "training_policies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_policy_roles" (
    "policyId" TEXT NOT NULL,
    "accountType" "UserAccountType" NOT NULL,

    CONSTRAINT "training_policy_roles_pkey" PRIMARY KEY ("policyId","accountType")
);

-- AddForeignKey
ALTER TABLE "training_policy_roles" ADD CONSTRAINT "training_policy_roles_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "training_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
