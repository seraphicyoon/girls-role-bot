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
const girlsCommand = new SlashCommandBuilder()
  .setName("girls")
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

const sayCommand = new SlashCommandBuilder()
  .setName("say")
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

const boosterCommand = new SlashCommandBuilder()
  .setName("booster")
  .setDescription("Interacción especial para Server Boosters")
  .addStringOption((option) =>
    option
      .setName("accion")
      .setDescription("La acción que quieres usar")
      .setRequired(true)
      .addChoices(
        { name: "hug", value: "hug" },
        { name: "kiss", value: "kiss" },
        { name: "pat", value: "pat" },
        { name: "slap", value: "slap" },
        { name: "cuddle", value: "cuddle" },
        { name: "wave", value: "wave" }
      )
  )
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuario objetivo")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("gif")
      .setDescription("Link directo del GIF o imagen")
      .setRequired(true)
  );

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const commands = [
    girlsCommand,
    pendientesCommand,
    limpiarCommand,
    sayCommand,
    bienvenidaCommand,
    boosterCommand,
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
      await cleanupBoosterHistories(fullGuild);
    }
  } catch (e) {
    console.error("❌ Error limpiando historiales booster al iniciar:", e);
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
    hug: "abrazó 🤗",
    kiss: "besó 💋",
    pat: "acarició 🫳",
    slap: "golpeó 💥",
    cuddle: "se acurrucó con 🫂",
    wave: "saludó 👋",
  };

  return accionesTexto[accion] || "interactuó con";
}

function ensureUserInteractionData(userId) {
  if (!interacciones[userId]) {
    interacciones[userId] = {
      hug: 0,
      kiss: 0,
      pat: 0,
      slap: 0,
      cuddle: 0,
      wave: 0,
    };
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

async function cleanupBoosterHistories(guild) {
  try {
    await ensureMembersFetched(guild);

    let removed = 0;

    for (const userId of Object.keys(interacciones)) {
      const member = guild.members.cache.get(userId);
      if (!member || !member.premiumSince) {
        delete interacciones[userId];
        removed++;
      }
    }

    if (removed > 0) {
      guardarInteracciones();
      console.log(`🗑️ Historiales booster limpiados al iniciar: ${removed}`);
    } else {
      console.log("✅ No había historiales booster obsoletos.");
    }
  } catch (e) {
    console.error("Error en cleanupBoosterHistories:", e);
  }
}

// ===== COOLDOWN BOOSTER =====
const boosterCooldown = new Map();
const BOOSTER_COOLDOWN_MS = 20 * 1000;

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  try {
    // ===== /say =====
    if (interaction.commandName === "say") {
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
        `📝 **/say usado**\n` +
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

    // ===== /girls =====
    if (interaction.commandName === "girls") {
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

      await sendLog(interaction, `✅ **/girls usado** por ${interaction.user.tag} a ${member.user.tag}`);
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

    // ===== /booster =====
    if (interaction.commandName === "booster") {
      await interaction.deferReply();

      if (BOOSTER_ROLE_ID === "PON_AQUI_EL_ID_DEL_ROL_SERVER_BOOSTER") {
        return interaction.editReply("❌ Aún no configuraste `BOOSTER_ROLE_ID` en el código.");
      }

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
      const gif = interaction.options.getString("gif", true).trim();

      if (!isValidMediaUrl(gif)) {
        return interaction.editReply(
          "❌ El link no es válido. Usa un link directo que termine en `.gif`, `.png`, `.jpg`, `.jpeg` o `.webp`."
        );
      }

      boosterCooldown.set(interaction.user.id, Date.now());

      ensureUserInteractionData(interaction.user.id);
      interacciones[interaction.user.id][accion] =
        (interacciones[interaction.user.id][accion] || 0) + 1;

      guardarInteracciones();

      const totalUsuario = interacciones[interaction.user.id][accion];
      const actionText = getActionText(accion);

      const embed = new EmbedBuilder()
        .setColor(0xFADADD)
        .setTitle(`${interaction.user.username} ${actionText} a ${targetUser.username}`)
        .setDescription(`✨ **${accion.toUpperCase()} #${totalUsuario}** para **${interaction.user.username}**`)
        .setImage(gif)
        .setFooter({ text: "Interacciones especiales para Server Boosters 💎" })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { users: [targetUser.id] },
      });

      await sendLog(
        interaction,
        `💎 **/booster usado**\n` +
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

// ===== BORRAR HISTORIAL SI DEJA DE BOOSTEAR =====
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const antesBoosteaba = !!oldMember.premiumSince;
    const ahoraBoostea = !!newMember.premiumSince;

    if (antesBoosteaba && !ahoraBoostea) {
      if (interacciones[newMember.id]) {
        delete interacciones[newMember.id];
        guardarInteracciones();
        console.log(`🗑️ Historial booster eliminado para ${newMember.user.tag} (${newMember.id})`);
      }
    }
  } catch (err) {
    console.error("Error en guildMemberUpdate al limpiar historial booster:", err);
  }
});

// ===== Anti-crash =====
process.on("unhandledRejection", (reason) => console.error("❌ unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("❌ uncaughtException:", err));

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
