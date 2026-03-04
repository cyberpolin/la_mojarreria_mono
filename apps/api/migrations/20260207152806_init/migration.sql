-- CreateTable
CREATE TABLE "DailyCloseRaw" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL DEFAULT 'kiosk-001',
    "date" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "DailyCloseRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClose" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "cashReceived" INTEGER NOT NULL DEFAULT 0,
    "bankTransfersReceived" INTEGER NOT NULL DEFAULT 0,
    "deliveryCashPaid" INTEGER NOT NULL DEFAULT 0,
    "otherCashExpenses" INTEGER NOT NULL DEFAULT 0,
    "expectedTotal" INTEGER NOT NULL DEFAULT 0,
    "totalFromItems" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceRaw" UUID,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "DailyClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCloseItem" (
    "id" UUID NOT NULL,
    "close" UUID,
    "productId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyCloseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auth" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "recoveryId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "user" UUID,
    "sing" UUID,
    "closedRegisters" UUID,
    "openedRegisters" UUID,
    "pin" TEXT,
    "clockCard" UUID,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" UUID NOT NULL,
    "user" UUID,
    "agent" UUID,
    "status" TEXT DEFAULT 'BOT',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "hasOrder" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sender" TEXT DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "internalId" TEXT NOT NULL DEFAULT '',
    "chat" UUID,
    "user" UUID,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "image" JSONB,
    "timeProcess" TEXT DEFAULT '30 minutos',

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "client" UUID,
    "productsWithAmount" TEXT NOT NULL DEFAULT '',
    "isDelivery" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT NOT NULL DEFAULT '',
    "deliveryCost" DOUBLE PRECISION,
    "deliveryTime" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" UUID NOT NULL,
    "product" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT DEFAULT 'open',
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "closingBalance" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rawMaterial" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,

    CONSTRAINT "rawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listener" (
    "id" UUID NOT NULL,
    "listenerId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Listener_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sing" (
    "id" UUID NOT NULL,
    "phones" TEXT NOT NULL DEFAULT '',
    "modeDeveloper" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRStaff" (
    "id" UUID NOT NULL,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockCard" (
    "id" UUID NOT NULL,
    "auth" UUID,
    "getIn" TIMESTAMP(3),
    "getOut" TIMESTAMP(3),

    CONSTRAINT "ClockCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Order_products" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateTable
CREATE TABLE "_Order_relatedOrders" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE INDEX "DailyCloseRaw_deviceId_idx" ON "DailyCloseRaw"("deviceId");

-- CreateIndex
CREATE INDEX "DailyCloseRaw_date_idx" ON "DailyCloseRaw"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_deviceId_key" ON "DailyClose"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_date_key" ON "DailyClose"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_sourceRaw_key" ON "DailyClose"("sourceRaw");

-- CreateIndex
CREATE INDEX "DailyCloseItem_close_idx" ON "DailyCloseItem"("close");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_email_key" ON "Auth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_user_key" ON "Auth"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_sing_key" ON "Auth"("sing");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_closedRegisters_key" ON "Auth"("closedRegisters");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_openedRegisters_key" ON "Auth"("openedRegisters");

-- CreateIndex
CREATE INDEX "Auth_clockCard_idx" ON "Auth"("clockCard");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "ChatSession_user_idx" ON "ChatSession"("user");

-- CreateIndex
CREATE INDEX "ChatSession_agent_idx" ON "ChatSession"("agent");

-- CreateIndex
CREATE INDEX "Message_chat_idx" ON "Message"("chat");

-- CreateIndex
CREATE INDEX "Message_user_idx" ON "Message"("user");

-- CreateIndex
CREATE INDEX "Order_client_idx" ON "Order"("client");

-- CreateIndex
CREATE INDEX "Stock_product_idx" ON "Stock"("product");

-- CreateIndex
CREATE INDEX "CashRegister_date_idx" ON "CashRegister"("date");

-- CreateIndex
CREATE INDEX "ClockCard_auth_idx" ON "ClockCard"("auth");

-- CreateIndex
CREATE UNIQUE INDEX "_Order_products_AB_unique" ON "_Order_products"("A", "B");

-- CreateIndex
CREATE INDEX "_Order_products_B_index" ON "_Order_products"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Order_relatedOrders_AB_unique" ON "_Order_relatedOrders"("A", "B");

-- CreateIndex
CREATE INDEX "_Order_relatedOrders_B_index" ON "_Order_relatedOrders"("B");

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_sourceRaw_fkey" FOREIGN KEY ("sourceRaw") REFERENCES "DailyCloseRaw"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCloseItem" ADD CONSTRAINT "DailyCloseItem_close_fkey" FOREIGN KEY ("close") REFERENCES "DailyClose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_sing_fkey" FOREIGN KEY ("sing") REFERENCES "Sing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_closedRegisters_fkey" FOREIGN KEY ("closedRegisters") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_openedRegisters_fkey" FOREIGN KEY ("openedRegisters") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_clockCard_fkey" FOREIGN KEY ("clockCard") REFERENCES "ClockCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_agent_fkey" FOREIGN KEY ("agent") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chat_fkey" FOREIGN KEY ("chat") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_client_fkey" FOREIGN KEY ("client") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCard" ADD CONSTRAINT "ClockCard_auth_fkey" FOREIGN KEY ("auth") REFERENCES "Auth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Order_products" ADD CONSTRAINT "_Order_products_A_fkey" FOREIGN KEY ("A") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Order_products" ADD CONSTRAINT "_Order_products_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Order_relatedOrders" ADD CONSTRAINT "_Order_relatedOrders_A_fkey" FOREIGN KEY ("A") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Order_relatedOrders" ADD CONSTRAINT "_Order_relatedOrders_B_fkey" FOREIGN KEY ("B") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
