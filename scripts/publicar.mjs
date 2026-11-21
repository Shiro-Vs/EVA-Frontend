// Publica una actualización por internet (EAS Update) para la gente que ya tiene la app instalada.
// Uso:  npm run publicar -- "Qué cambió"            (canal «preview»: tú y tus amigos)
//       npm run publicar:produccion -- "Qué cambió"  (canal «production»)
// Siempre usa las direcciones de PRODUCCIÓN de eas.json, aunque tu .env apunte a tu PC: una actualización con la IP de tu casa dejaría la app sin conexión.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [channel, ...rest] = process.argv.slice(2);
const message = rest.join(" ").trim();
if (!channel || !message) {
  console.error('Falta el mensaje. Ejemplo: npm run publicar -- "Mejoré la pantalla de Dinero"');
  process.exit(1);
}

const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
const env = eas.build?.[channel]?.env;
if (!env?.EXPO_PUBLIC_API_URL) {
  console.error(`eas.json no tiene variables de entorno para el perfil «${channel}».`);
  process.exit(1);
}
if (/localhost|127\.0\.0\.1|192\.168\./.test(env.EXPO_PUBLIC_API_URL)) {
  console.error(`La dirección de la API en eas.json (${env.EXPO_PUBLIC_API_URL}) es local: no se publica.`);
  process.exit(1);
}

console.log(`Publicando en el canal «${channel}»: ${message}`);
const args = ["--yes", "eas-cli", "update", "--channel", channel, "--message", message];
const isWin = process.platform === "win32";
const r = isWin
  ? spawnSync(`npx ${args.map((a) => `"${a.replace(/["\r\n]/g, "'")}"`).join(" ")}`, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...env },
    })
  : spawnSync("npx", args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
process.exit(r.status ?? 1);
