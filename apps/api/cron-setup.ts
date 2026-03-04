import cron from "node-cron";

export function setupCronJobs(context: any) {
  //   console.log("🕒 Iniciando cron jobs...");

  cron.schedule("*/30 * * * * *", async () => {
    try {
      if (!context?.db?.QRStaff) {
        console.log("⏳ Contexto no disponible, esperando...");
        return;
      }

      const twoMinutesAgo = new Date(Date.now() - 120000);

      const oldRecords = await context.db.QRStaff.findMany({
        where: {
          createdAt: { lte: twoMinutesAgo },
        },
      });

      console.log(`🔍 Encontrados ${oldRecords.length} registros para limpiar`);

      for (const record of oldRecords) {
        await context.db.QRStaff.deleteOne({
          where: { id: record.id },
        });
        console.log(`✅ Eliminado registro: ${record.id}`);
      }
    } catch (error) {
      console.error("❌ Error en cron job:", error);
    }
  });

  console.log("✅ Cron jobs iniciados correctamente");
}
