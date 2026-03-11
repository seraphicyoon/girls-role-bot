require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const CLIENT_ID = (process.env.CLIENT_ID || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();
const LOG_CHANNEL_ID = (process.env.LOG_CHANNEL_ID || "").trim();

// ===== ARCHIVO PARA VERIFICACIONES =====
const VERIF_DB_FILE = path.join(__dirname, "verificadas.json");
let verificadas = {};

if (fs.existsSync(VERIF_DB_FILE)) {
  try {
    verificadas = JSON.parse(fs.readFileSync(VERIF_DB_FILE, "utf8"));
  } catch (e) {
    console.error("Error cargando verificadas.json:", e);
  }
} else {
  fs.writeFileSync(VERIF_DB_FILE, "{}", "utf8");
  console.log("✅ Creado verificadas.json automáticamente");
}

function guardarVerificadas() {
  fs.writeFileSync(VERIF_DB_FILE, JSON.stringify(verificadas, null, 2), "utf8");
}

// ===== ARCHIVO PARA INTERACCIONES BOOSTER =====
const INTER_DB_FILE = path.join(__dirname, "interacciones.json");
let interacciones = {};

if (fs.existsSync(INTER_DB_FILE)) {
  try {
    interacciones = JSON.parse(fs.readFileSync(INTER_DB_FILE, "utf8"));
  } catch (e) {
    console.error("Error cargando interacciones.json:", e);
  }
} else {
  fs.writeFileSync(INTER_DB_FILE, "{}", "utf8");
  console.log("✅ Creado interacciones.json automáticamente");
}

function guardarInteracciones() {
  fs.writeFileSync(INTER_DB_FILE, JSON.stringify(interacciones, null, 2), "utf8");
}

// ===== ARCHIVO PARA GIFS DE BOOSTERS =====
const GIFS_DB_FILE = path.join(__dirname, "gifs_booster.json");
let gifsBooster = {};

if (fs.existsSync(GIFS_DB_FILE)) {
  try {
    gifsBooster = JSON.parse(fs.readFileSync(GIFS_DB_FILE, "utf8"));
  } catch (e) {
    console.error("Error cargando gifs_booster.json:", e);
  }
} else {
  fs.writeFileSync(GIFS_DB_FILE, "{}", "utf8");
  console.log("✅ Creado gifs_booster.json automáticamente");
}

function guardarGifsBooster() {
  fs.writeFileSync(GIFS_DB_FILE, JSON.stringify(gifsBooster, null, 2), "utf8");
}

// ===== CONFIG =====
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";
const BOOSTER_ROLE_ID = "1081615312891412480";

const allowedRoleIds = [
  "1447179100551905321", // Admin
  "1222199503873114175", // Mod
  "996585466197454929", // Helper
  "997485830341918730", // Owner
];

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===== COMMANDS =====
const verificarCommand = new SlashCommandBuilder()
  .setName("verificar")
  .setDescription("Asigna el rol Girls y quita no verificadas")
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario a verificar").setRequired(true)
  );

const pendientesCommand = new SlashCommandBuilder()
  .setName("pendientes")
  .setDescription("Lista personas con no verificadas desde hace 5 días");

const limpiarCommand = new SlashCommandBuilder()
  .setName("limpiar_pendientes")
  .setDescription("Expulsa personas con no verificadas (5 días)")
  .addBooleanOption((option) =>
    option
      .setName("confirmar")
      .setDescription("⚠️ true = expulsar | false = solo preview")
      .setRequired(true)
  );

const decirCommand = new SlashCommandBuilder()
  .setName("decir")
  .setDescription("Enviar un mensaje como el bot (anónimo)")
  .addStringOption((option) =>
    option.setName("mensaje").setDescription("Mensaje que enviará el bot").setRequired(true)
  );

const bienvenidaCommand = new SlashCommandBuilder()
  .setName("bienvenida")
  .setDescription("Envía el mensaje de verificación/bienvenida a una usuaria")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuaria a la que se le enviará la bienvenida")
      .setRequired(true)
  );

const interaccionCommand = new SlashCommandBuilder()
  .setName("interaccion")
  .setDescription("Interacción especial para Server Boosters")
  .addStringOption((option) =>
    option
      .setName("accion")
      .setDescription("La acción que quieres usar")
      .setRequired(true)
      .addChoices(
        { name: "abrazar", value: "abrazar" },
        { name: "besar", value: "besar" },
        { name: "acariciar", value: "acariciar" },
        { name: "golpear", value: "golpear" },
        { name: "acurrucar", value: "acurrucar" },
        { name: "saludar", value: "saludar" }
      )
  )
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuario objetivo")
      .setRequired(true)
  );

const configurarGifCommand = new SlashCommandBuilder()
  .setName("configurar_gif")
  .setDescription("Configura o reemplaza tu GIF para una acción")
  .addStringOption((option) =>
    option
      .setName("accion")
      .setDescription("La acción a configurar")
      .setRequired(true)
      .addChoices(
        { name: "abrazar", value: "abrazar" },
        { name: "besar", value: "besar" },
        { name: "acariciar", value: "acariciar" },
        { name: "golpear", value: "golpear" },
        { name: "acurrucar", value: "acurrucar" },
        { name: "saludar", value: "saludar" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("link")
      .setDescription("Link directo del GIF o imagen")
      .setRequired(true)
  );

const verGifsCommand = new SlashCommandBuilder()
  .setName("ver_gifs")
  .setDescription("Muestra los GIFs que tienes configurados para tus acciones");

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const commands = [
    verificarCommand,
    pendientesCommand,
    limpiarCommand,
    decirCommand,
    bienvenidaCommand,
    interaccionCommand,
    configurarGifCommand,
    verGifsCommand,
  ].map((c) => c.toJSON());

  console.log("🧹 Borrando comandos del guild...");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  console.log("✅ Comandos borrados. Re-registrando...");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("🎉 Comandos re-registrados correctamente.");
}

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);

  try {
    await registerCommands();
    console.log("✅ Comandos registrados/actualizados.");
  } catch (e) {
    console.error("❌ Error registrando comandos:", e);
  }

  if (!LOG_CHANNEL_ID) {
    console.log("⚠️ LOG_CHANNEL_ID no está configurado.");
  } else {
    console.log(`✅ LOG_CHANNEL_ID: ${LOG_CHANNEL_ID}`);
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (guild) {
      const fullGuild = await guild.fetch();
      await cleanupBoosterData(fullGuild);
    }
  } catch (e) {
    console.error("❌ Error limpiando datos booster al iniciar:", e);
  }
});

// ===== HELPERS =====
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function invokerHasPermission(interaction) {
  if (!interaction.inGuild()) return false;
  const invoker = await interaction.guild.members.fetch(interaction.user.id);
  return invoker.roles.cache.some((r) => allowedRoleIds.includes(r.id));
}

async function invokerIsStaffOrBooster(interaction) {
  if (!interaction.inGuild()) return false;
  const invoker = await interaction.guild.members.fetch(interaction.user.id);
  return (
    invoker.roles.cache.some((r) => allowedRoleIds.includes(r.id)) ||
    invoker.roles.cache.has(BOOSTER_ROLE_ID)
  );
}

async function sendLog(interaction, content) {
  if (!LOG_CHANNEL_ID) return { ok: false, error: "LOG_CHANNEL_ID no configurado" };

  try {
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) {
      return { ok: false, error: "Canal de logs inválido" };
    }

    await logChannel.send({ content, allowedMentions: { parse: [] } });
    return { ok: true };
  } catch (e) {
    console.error("❌ Error log:", e);
    return { ok: false, error: e?.message || "desconocido" };
  }
}

function isValidMediaUrl(url) {
  if (!url || typeof url !== "string") return false;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const lower = url.toLowerCase();

    if (/\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(lower)) return true;
    if (lower.includes("media.discordapp.net")) return true;
    if (lower.includes("cdn.discordapp.com")) return true;
    if (lower.includes("images-ext-1.discordapp.net")) return true;
    if (lower.includes("i.imgur.com")) return true;
    if (lower.includes("media.tenor.com")) return true;
    if (lower.includes("c.tenor.com")) return true;

    return false;
  } catch {
    return false;
  }
}

function getActionText(accion) {
  const accionesTexto = {
    abrazar: "abrazó 🤗",
    besar: "besó 💋",
    acariciar: "acarició 🫳",
    golpear: "golpeó 💥",
    acurrucar: "se acurrucó con 🫂",
    saludar: "saludó 👋",
  };

  return accionesTexto[accion] || "interactuó con";
}

function getNaturalCounterText(accion, total, nombreObjetivo) {
  const plural = total === 1 ? "" : "s";

  const textos = {
    abrazar: `✨ **${nombreObjetivo}** ha recibido **${total} abrazo${plural}**`,
    besar: `✨ **${nombreObjetivo}** ha recibido **${total} beso${plural}**`,
    acariciar: `✨ **${nombreObjetivo}** ha recibido **${total} caricia${plural}**`,
    golpear: `✨ **${nombreObjetivo}** ha recibido **${total} golpe${plural}**`,
    acurrucar: `✨ **${nombreObjetivo}** ha recibido **${total} acurrucón${plural}**`,
    saludar: `✨ **${nombreObjetivo}** ha recibido **${total} saludo${plural}**`,
  };

  return textos[accion] || `✨ **${nombreObjetivo}** ha recibido **${total} interacción${plural}**`;
}

function getActionLabel(accion) {
  const etiquetas = {
    abrazar: "Abrazar",
    besar: "Besar",
    acariciar: "Acariciar",
    golpear: "Golpear",
    acurrucar: "Acurrucar",
    saludar: "Saludar",
  };

  return etiquetas[accion] || accion;
}

function ensureUserInteractionData(userId) {
  if (!interacciones[userId]) {
    interacciones[userId] = {
      abrazar: 0,
      besar: 0,
      acariciar: 0,
      golpear: 0,
      acurrucar: 0,
      saludar: 0,
    };
  }

  if (typeof interacciones[userId].hug === "number") {
    interacciones[userId].abrazar = (interacciones[userId].abrazar || 0) + interacciones[userId].hug;
    delete interacciones[userId].hug;
  }
  if (typeof interacciones[userId].kiss === "number") {
    interacciones[userId].besar = (interacciones[userId].besar || 0) + interacciones[userId].kiss;
    delete interacciones[userId].kiss;
  }
  if (typeof interacciones[userId].pat === "number") {
    interacciones[userId].acariciar = (interacciones[userId].acariciar || 0) + interacciones[userId].pat;
    delete interacciones[userId].pat;
  }
  if (typeof interacciones[userId].slap === "number") {
    interacciones[userId].golpear = (interacciones[userId].golpear || 0) + interacciones[userId].slap;
    delete interacciones[userId].slap;
  }
  if (typeof interacciones[userId].cuddle === "number") {
    interacciones[userId].acurrucar = (interacciones[userId].acurrucar || 0) + interacciones[userId].cuddle;
    delete interacciones[userId].cuddle;
  }
  if (typeof interacciones[userId].wave === "number") {
    interacciones[userId].saludar = (interacciones[userId].saludar || 0) + interacciones[userId].wave;
    delete interacciones[userId].wave;
  }
}

function ensureUserGifData(userId) {
  if (!gifsBooster[userId]) {
    gifsBooster[userId] = {};
  }

  if (typeof gifsBooster[userId].hug === "string") {
    gifsBooster[userId].abrazar = gifsBooster[userId].hug;
    delete gifsBooster[userId].hug;
  }
  if (typeof gifsBooster[userId].kiss === "string") {
    gifsBooster[userId].besar = gifsBooster[userId].kiss;
    delete gifsBooster[userId].kiss;
  }
  if (typeof gifsBooster[userId].pat === "string") {
    gifsBooster[userId].acariciar = gifsBooster[userId].pat;
    delete gifsBooster[userId].pat;
  }
  if (typeof gifsBooster[userId].slap === "string") {
    gifsBooster[userId].golpear = gifsBooster[userId].slap;
    delete gifsBooster[userId].slap;
  }
  if (typeof gifsBooster[userId].cuddle === "string") {
    gifsBooster[userId].acurrucar = gifsBooster[userId].cuddle;
    delete gifsBooster[userId].cuddle;
  }
  if (typeof gifsBooster[userId].wave === "string") {
    gifsBooster[userId].saludar = gifsBooster[userId].wave;
    delete gifsBooster[userId].wave;
  }
}

const FETCH_COOLDOWN_MS = 5 * 60 * 1000;
let lastFetchAt = 0;
let fetchingPromise = null;

async function ensureMembersFetched(guild) {
  const now = Date.now();

  if (now - lastFetchAt < FETCH_COOLDOWN_MS) {
    console.log("[fetch] Cache reciente, usando miembros en memoria.");
    return;
  }

  if (fetchingPromise) {
    console.log("[fetch] Ya hay un fetch en curso, esperando...");
    return fetchingPromise;
  }

  fetchingPromise = (async () => {
    try {
      console.log("[fetch] Cargando miembros...");
      await guild.members.fetch();
      lastFetchAt = Date.now();
      console.log("[fetch] Miembros cargados OK.");
    } catch (e) {
      console.error("[fetch] Error:", e);
      if (e.code === 50035 || e.message.includes("rate limited")) {
        const retryAfter = e.retry_after || 30;
        console.log(`[fetch] Rate limit! Esperando ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        throw new Error(`RATE_LIMIT_FETCH:${retryAfter}`);
      }
      throw e;
    } finally {
      fetchingPromise = null;
    }
  })();

  return fetchingPromise;
}

async function cleanupBoosterData(guild) {
  try {
    await ensureMembersFetched(guild);

    let removedInteracciones = 0;
    let removedGifs = 0;

    for (const userId of Object.keys(interacciones)) {
      const member = guild.members.cache.get(userId);
      if (!member || !member.premiumSince) {
        delete interacciones[userId];
        removedInteracciones++;
      } else {
        ensureUserInteractionData(userId);
      }
    }

    for (const userId of Object.keys(gifsBooster)) {
      const member = guild.members.cache.get(userId);
      if (!member || !member.premiumSince) {
        delete gifsBooster[userId];
        removedGifs++;
      } else {
        ensureUserGifData(userId);
      }
    }

    if (removedInteracciones > 0 || Object.keys(interacciones).length > 0) {
      guardarInteracciones();
    }

    if (removedGifs > 0 || Object.keys(gifsBooster).length > 0) {
      guardarGifsBooster();
    }

    console.log(`✅ Limpieza booster al iniciar | Interacciones borradas: ${removedInteracciones} | GIFs borrados: ${removedGifs}`);
  } catch (e) {
    console.error("Error en cleanupBoosterData:", e);
  }
}

// ===== COOLDOWN BOOSTER =====
const boosterCooldown = new Map();
const BOOSTER_COOLDOWN_MS = 20 * 1000;

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  try {
    // ===== /decir =====
    if (interaction.commandName === "decir") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const texto = interaction.options.getString("mensaje", true);

      if (texto.includes("@everyone") || texto.includes("@here")) {
        return interaction.editReply("❌ No se permite @everyone/@here.");
      }

      const sentMessage = await interaction.channel.send({
        content: texto,
        allowedMentions: { parse: [] },
      });

      const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;
      const logText =
        `📝 **/decir usado**\n` +
        `Usuario: ${interaction.user.tag}\n` +
        `Canal: <#${interaction.channelId}>\n` +
        `Link: ${jumpLink}\n` +
        `Mensaje: ${texto}`;

      await sendLog(interaction, logText);
      return interaction.editReply("✅ Mensaje enviado.");
    }

    // ===== /bienvenida =====
    if (interaction.commandName === "bienvenida") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const user = interaction.options.getUser("usuario", true);
      const ROLES_CH = "1097575701739216947";
      const PRESENTACION_CH = "989867122605817887";
      const DUDAS_CH = "1252395723262001152";
      const CHARLA_CH = "989867080595701790";

      const texto = `Listo ${user} ya has sido verificada, espero y disfrutes tu estancia en el servidor <:01_lumi_corazon:1435352473543114832>
Te invito a pasarte por <#${ROLES_CH}> para llenar datos de tu perfil <:00_lumi_aww:1433442969662263427>
Te esperamos con tu <#${PRESENTACION_CH}> para conocerte mejor‼️
Si tienes dudas o sugerencias puedes dejarlas por aquí <#${DUDAS_CH}>
Ven a saludar y platicar con nosotros en <#${CHARLA_CH}> <:00_lumi_corazon:1433443102189813771>`;

      try {
        const sentMessage = await interaction.channel.send({
          content: texto,
          allowedMentions: { users: [user.id] },
        });

        const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;
        const logText =
          `💌 **/bienvenida usado**\n` +
          `Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
          `Usuaria: ${user.tag} (${user.id})\n` +
          `Canal: <#${interaction.channelId}>\n` +
          `Link: ${jumpLink}`;

        await sendLog(interaction, logText).catch(() => {});
        return interaction.editReply("✅ Bienvenida enviada.");
      } catch (err) {
        console.error("Error enviando bienvenida:", err);
        return interaction.editReply("❌ No pude enviar la bienvenida. ¿Permisos?");
      }
    }

    // ===== /verificar =====
    if (interaction.commandName === "verificar") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const member = interaction.options.getMember("usuario");
      const girlsRole = interaction.guild.roles.cache.find((r) => r.name === GIRLS_ROLE_NAME);

      if (!member || !girlsRole) {
        return interaction.editReply("❌ Error obteniendo usuario o rol.");
      }

      const me = await interaction.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply("❌ No tengo permiso Manage Roles.");
      }

      if (me.roles.highest.position <= girlsRole.position) {
        return interaction.editReply("❌ Mi rol debe estar arriba de Girls.");
      }

      if (member.roles.cache.has(girlsRole.id)) {
        return interaction.editReply("ℹ️ Ya tiene Girls.");
      }

      await member.roles.add(girlsRole);

      if (member.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) {
        await member.roles.remove(NO_VERIFICADAS_ROLE_ID);
      }

      verificadas[member.id] = {
        verificadaPor: interaction.user.id,
        verificadaPorTag: interaction.user.tag,
        fecha: new Date().toISOString(),
      };
      guardarVerificadas();

      await sendLog(interaction, `✅ **/verificar usado** por ${interaction.user.tag} a ${member.user.tag}`);
      return interaction.editReply(
        `✅ ${member} verificada: **Girls** asignado y **no verificadas** removido.`
      );
    }

    // ===== /pendientes =====
    if (interaction.commandName === "pendientes") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      console.log("[/pendientes] Iniciando...");

      try {
        await ensureMembersFetched(interaction.guild);
      } catch (e) {
        if (String(e.message).includes("RATE_LIMIT_FETCH")) {
          const sec = e.message.split(":")[1] || "30";
          return interaction.editReply(`⏳ Discord me limitó. Intenta de nuevo en **${sec} segundos**.`);
        }
        console.error("[/pendientes] Error:", e);
        return interaction.editReply("❌ Error al cargar miembros.");
      }

      const pendientes = interaction.guild.members.cache.filter((m) => {
        if (m.user.bot) return false;
        if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
        if (!m.joinedAt) return false;
        return m.joinedAt.getTime() <= Date.now() - 5 * 24 * 60 * 60 * 1000;
      });

      if (pendientes.size === 0) {
        return interaction.editReply("✅ No hay pendientes de 5 días.");
      }

      const list = [...pendientes.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .slice(0, 40)
        .map((m, i) => {
          const t = Math.floor(m.joinedAt.getTime() / 1000);
          return `${i + 1}. ${m} — entró <t:${t}:R>`;
        });

      await sendLog(
        interaction,
        `📌 **/pendientes usado**\nStaff: ${interaction.user.tag}\nEncontrados: ${pendientes.size}`
      );

      return interaction.editReply(`📌 **Pendientes (5 días):** ${pendientes.size}\n\n${list.join("\n")}`);
    }

    // ===== /limpiar_pendientes =====
    if (interaction.commandName === "limpiar_pendientes") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const confirmar = interaction.options.getBoolean("confirmar", true);
      console.log("[/limpiar_pendientes] Iniciando...");

      try {
        await ensureMembersFetched(interaction.guild);
      } catch (e) {
        if (String(e.message).includes("RATE_LIMIT_FETCH")) {
          const sec = e.message.split(":")[1] || "30";
          return interaction.editReply(`⏳ Discord me limitó. Intenta de nuevo en **${sec} segundos**.`);
        }
        console.error("[/limpiar_pendientes] Error:", e);
        return interaction.editReply("❌ Error al cargar miembros.");
      }

      const pendientes = interaction.guild.members.cache.filter((m) => {
        if (m.user.bot) return false;
        if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
        if (!m.joinedAt) return false;
        return m.joinedAt.getTime() <= Date.now() - 5 * 24 * 60 * 60 * 1000;
      });

      if (pendientes.size === 0) {
        return interaction.editReply("✅ No hay nadie para expulsar.");
      }

      if (!confirmar) {
        await sendLog(
          interaction,
          `⚠️ **Preview /limpiar_pendientes**\nStaff: ${interaction.user.tag}\nSerían expulsadas: ${pendientes.size}`
        );
        return interaction.editReply(
          `⚠️ **Preview**: ${pendientes.size} personas serían expulsadas.\nUsa \`confirmar:true\` para ejecutar.`
        );
      }

      const me = await interaction.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return interaction.editReply("❌ No tengo permiso para expulsar.");
      }

      let kicked = 0;
      let failed = 0;

      for (const member of pendientes.values()) {
        try {
          if (member.kickable) {
            await member.kick("No verificada después de 5 días");
            kicked++;
            await sleep(1500);
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
          await sleep(1500);
        }
      }

      await sendLog(
        interaction,
        `🧹 **/limpiar_pendientes ejecutado**\n` +
          `Staff: ${interaction.user.tag}\n` +
          `✅ Expulsadas: ${kicked}\n` +
          `⚠️ Fallidas: ${failed}`
      );

      return interaction.editReply(
        `🧹 Limpieza completa: **${kicked}** expulsadas.${failed ? ` (${failed} no se pudieron expulsar)` : ""}`
      );
    }

    // ===== /configurar_gif =====
    if (interaction.commandName === "configurar_gif") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerIsStaffOrBooster(interaction))) {
        return interaction.editReply("❌ Solo **Server Boosters** o staff pueden usar este comando.");
      }

      const accion = interaction.options.getString("accion", true);
      const link = interaction.options.getString("link", true).trim();

      if (!isValidMediaUrl(link)) {
        return interaction.editReply(
          "❌ El link no es válido. Usa un link directo que termine en `.gif`, `.png`, `.jpg`, `.jpeg` o `.webp`."
        );
      }

      ensureUserGifData(interaction.user.id);
      gifsBooster[interaction.user.id][accion] = link;
      guardarGifsBooster();

      return interaction.editReply(
        `✅ Tu GIF para **${getActionLabel(accion)}** fue configurado correctamente.`
      );
    }

    // ===== /ver_gifs =====
    if (interaction.commandName === "ver_gifs") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerIsStaffOrBooster(interaction))) {
        return interaction.editReply("❌ Solo **Server Boosters** o staff pueden usar este comando.");
      }

      ensureUserGifData(interaction.user.id);

      const acciones = ["abrazar", "besar", "acariciar", "golpear", "acurrucar", "saludar"];
      const lineas = acciones.map((accion) => {
        const tiene = gifsBooster[interaction.user.id]?.[accion];
        return `• **${getActionLabel(accion)}**: ${tiene ? "✅ Configurado" : "❌ Sin configurar"}`;
      });

      return interaction.editReply(`🎞️ **Tus GIFs guardados:**\n\n${lineas.join("\n")}`);
    }

    // ===== /interaccion =====
    if (interaction.commandName === "interaccion") {
      await interaction.deferReply();

      if (!(await invokerIsStaffOrBooster(interaction))) {
        return interaction.editReply("❌ Solo **Server Boosters** o staff pueden usar este comando.");
      }

      const lastUse = boosterCooldown.get(interaction.user.id);
      if (lastUse && Date.now() - lastUse < BOOSTER_COOLDOWN_MS) {
        const remaining = Math.ceil((BOOSTER_COOLDOWN_MS - (Date.now() - lastUse)) / 1000);
        return interaction.editReply(`⏳ Espera **${remaining}s** antes de usarlo otra vez.`);
      }

      const accion = interaction.options.getString("accion", true);
      const targetUser = interaction.options.getUser("usuario", true);

      ensureUserGifData(interaction.user.id);
      const gif = gifsBooster[interaction.user.id]?.[accion];

      if (!gif) {
        return interaction.editReply(
          `❌ No tienes un GIF configurado para **${getActionLabel(accion)}**.\nUsa \`/configurar_gif\` primero.`
        );
      }

      if (!isValidMediaUrl(gif)) {
        return interaction.editReply(
          `❌ El GIF que guardaste para **${getActionLabel(accion)}** ya no es válido.\nConfigúralo otra vez con \`/configurar_gif\`.`
        );
      }

      boosterCooldown.set(interaction.user.id, Date.now());

      const autorMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const nombreAutor = autorMember ? autorMember.displayName : interaction.user.username;
      const nombreObjetivo = targetMember ? targetMember.displayName : targetUser.username;

      ensureUserInteractionData(targetUser.id);
      interacciones[targetUser.id][accion] =
        (interacciones[targetUser.id][accion] || 0) + 1;

      guardarInteracciones();

      const totalObjetivo = interacciones[targetUser.id][accion];
      const actionText = getActionText(accion);
      const naturalCounter = getNaturalCounterText(accion, totalObjetivo, nombreObjetivo);

      const embed = new EmbedBuilder()
        .setColor(0xFADADD)
        .setTitle(`${nombreAutor} ${actionText} a ${nombreObjetivo}`)
        .setDescription(naturalCounter)
        .setImage(gif)
        .setFooter({ text: "Interacciones especiales para Server Boosters 💎" })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { users: [targetUser.id] },
      });

      await sendLog(
        interaction,
        `💎 **/interaccion usado**\n` +
          `Usuario: ${interaction.user.tag} (${interaction.user.id})\n` +
          `Acción: ${accion}\n` +
          `Objetivo: ${targetUser.tag} (${targetUser.id})`
      ).catch(() => {});
    }
  } catch (err) {
    console.error("❌ Error en interactionCreate:", err);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("❌ Error interno del bot.").catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Error interno.", ephemeral: true }).catch(() => {});
    }
  }
});

// ===== BORRAR DATOS SI DEJA DE BOOSTEAR =====
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const antesBoosteaba = !!oldMember.premiumSince;
    const ahoraBoostea = !!newMember.premiumSince;

    if (antesBoosteaba && !ahoraBoostea) {
      let borrado = false;

      if (interacciones[newMember.id]) {
        delete interacciones[newMember.id];
        guardarInteracciones();
        borrado = true;
      }

      if (gifsBooster[newMember.id]) {
        delete gifsBooster[newMember.id];
        guardarGifsBooster();
        borrado = true;
      }

      if (borrado) {
        console.log(`🗑️ Datos booster eliminados para ${newMember.user.tag} (${newMember.id})`);
      }
    }
  } catch (err) {
    console.error("Error en guildMemberUpdate al limpiar datos booster:", err);
  }
});

// ===== Anti-crash =====
process.on("unhandledRejection", (reason) => console.error("❌ unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("❌ uncaughtException:", err));

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
