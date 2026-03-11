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

// ===== CONFIG =====
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";
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

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const commands = [
    girlsCommand,
    pendientesCommand,
    limpiarCommand,
    sayCommand,
    bienvenidaCommand,
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

const FETCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
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
  } catch (err) {
    console.error("❌ Error en interactionCreate:", err);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("❌ Error interno del bot.").catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Error interno.", ephemeral: true }).catch(() => {});
    }
  }
});

// ===== Anti-crash =====
process.on("unhandledRejection", (reason) => console.error("❌ unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("❌ uncaughtException:", err));

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
