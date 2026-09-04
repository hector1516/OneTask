import 'dotenv/config';
import { migrate } from './db';
import { ensureSeedAdmin } from './auth';
import { seedModules } from './modules';

async function main(): Promise<void> {
  await migrate();
  await ensureSeedAdmin();
  const mods = await seedModules();
  console.log(`[seed] ${mods.length} módulo(s) firmado(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] falló:', err);
  process.exit(1);
});
