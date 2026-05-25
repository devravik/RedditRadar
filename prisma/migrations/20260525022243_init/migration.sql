-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('REDDIT_DM', 'EMAIL', 'LINKEDIN');

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "redditId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "numComments" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedSignal" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "technologies" TEXT[],
    "painPoints" TEXT[],
    "seniority" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL,
    "startupStage" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_redditId_key" ON "Post"("redditId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedSignal_postId_key" ON "ExtractedSignal"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_postId_key" ON "Lead"("postId");

-- AddForeignKey
ALTER TABLE "ExtractedSignal" ADD CONSTRAINT "ExtractedSignal_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMessage" ADD CONSTRAINT "GeneratedMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
