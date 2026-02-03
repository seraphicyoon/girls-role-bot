const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ✅ Canal privado para logs (Railway)
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ===== CONFIG =====
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";

const allowedRoleIds = [
  "1447179100551905321", // Admin
  "1222199503873114175", // Mod
  "996585466197454929",  // Helper
  "997485830341918730",  // Owner
];

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ===== COMMANDS =====
const girlsCommand = new SlashCommandBuilder()
  .setName("girls")
  .setDescription("Asigna el rol Girls y quita no verificadas")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuario a verificar")
      .setRequired(true)
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
    option
      .setName("mensaje")
      .setDescription("Mensaje que enviará el bot")
      .setRequired(true)
  );

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [girlsCommand, pendientesCommand, limpiarCommand, sayCommand].map((c) =>
      c.toJSON()
    ),
  });
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
    console.log("⚠️ LOG_CHANNEL_ID no está configurado en Railway (Variables).");
  } else {
    console.log(`✅ LOG_CHANNEL_ID configurado: ${LOG_CHANNEL_ID}`);
  }
});

// ===== HELPERS =====
async function invokerHasPermission(interaction) {
  if (!interaction.inGuild()) return false;
  const invoker = await interaction.guild.members.fetch(interaction.user.id);
  return invoker.roles.cache.some((r) => allowedRoleIds.includes(r.id));
}

function getPendientes(guild) {
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - FIVE_DAYS;

  return guild.members.cache.filter((m) => {
    if (m.user.bot) return false;
    if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
    if (!m.joinedAt) return false;
    return m.joinedAt.getTime() <= cutoff; // 5 días o más
  });
}

// Nunca dejes que un fallo de logs rompa el comando
async function sendLogSafe(interaction, content) {
  if (!LOG_CHANNEL_ID) return;

  try {
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel || !logChannel.isTextBased()) return;

    await logChannel.send({ content, allowedMentions: { parse: [] } });
  } catch (e) {
    console.error("❌ Error enviando log:", e?.message || e);
  }
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

// Respuesta segura (evita “Unknown interaction” si alguien spamea)
async function safeDefer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch {}
}
async function safeEdit(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(content);
    }
    return await interaction.reply({ content, ephemeral: true });
  } catch (e) {
    console.error("❌ safeEdit error:", e?.message || e);
  }
}

// ✅ Lock anti-spam por guild (para /limpiar_pendientes)
const limpiarLocks = new Map(); // guildId -> boolean

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;

    // ===== /say =====
    if (interaction.commandName === "say") {
      await safeDefer(interaction);

      if (!(await invokerHasPermission(interaction))) {
        return safeEdit(interaction, "❌ No tienes permiso.");
      }

      const texto = interaction.options.getString("mensaje", true);

      if (texto.includes("@everyone") || texto.includes("@here")) {
        return safeEdit(interaction, "❌ No se permite usar @everyone/@here con /say.");
      }

      const sentMessage = await interaction.channel.send({
        content: texto,
        allowedMentions: { parse: [] },
      });

      const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;

      await sendLogSafe(
        interaction,
        `📝 **/say usado**\n` +
          `👤 Usuario: ${interaction.user.tag} (${interaction.user.id})\n` +
          `📍 Canal: <#${interaction.channelId}>\n` +
          `🔗 Link: ${jumpLink}\n` +
          `🕒 Hora: <t:${nowTs()}:f>\n` +
          `💬 Mensaje:\n>>> ${texto}`
      );

      return safeEdit(interaction, "✅ Mensaje enviado.");
    }

    // ===== /girls =====
    if (interaction.commandName === "girls") {
      await safeDefer(interaction);

      if (!(await invokerHasPermission(interaction))) {
        return safeEdit(interaction, "❌ No tienes permiso.");
      }

      const member = interaction.options.getMember("usuario");
      const girlsRole = interaction.guild.roles.cache.find((r) => r.name === GIRLS_ROLE_NAME);

      if (!member || !girlsRole) {
        return safeEdit(interaction, "❌ Error obteniendo usuario o rol.");
      }

      const me = await interaction.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return safeEdit(interaction, "❌ No tengo permiso Manage Roles.");
      }

      if (me.roles.highest.position <= girlsRole.position) {
        return safeEdit(interaction, "❌ Mi rol debe estar arriba de Girls.");
      }

      if (member.roles.cache.has(girlsRole.id)) {
        return safeEdit(interaction, "ℹ️ Ya tiene Girls.");
      }

      await member.roles.add(girlsRole);

      if (member.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) {
        await member.roles.remove(NO_VERIFICADAS_ROLE_ID);
      }

      await sendLogSafe(
        interaction,
        `✅ **/girls usado**\n` +
          `👤 Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
          `🎯 Usuario: ${member.user.tag} (${member.user.id})\n` +
          `📍 Canal: <#${interaction.channelId}>\n` +
          `🕒 Hora: <t:${nowTs()}:f>`
      );

      return safeEdit(
        interaction,
        `✅ ${member} verificada: **Girls** asignado y **no verificadas** removido.`
      );
    }

    // ===== /pendientes =====
    if (interaction.commandName === "pendientes") {
      await safeDefer(interaction);

      if (!(await invokerHasPermission(interaction))) {
        return safeEdit(interaction, "❌ No tienes permiso.");
      }

      await interaction.guild.members.fetch();
      const pendientes = getPendientes(interaction.guild);

      const list = [...pendientes.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .slice(0, 40)
        .map((m, i) => {
          const t = Math.floor(m.joinedAt.getTime() / 1000);
          return `${i + 1}. ${m} — entró <t:${t}:R>`;
        });

      await sendLogSafe(
        interaction,
        `📌 **/pendientes usado**\n` +
          `👤 Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
          `📍 Canal: <#${interaction.channelId}>\n` +
          `🔢 Encontrados: ${pendientes.size}\n` +
          `🕒 Hora: <t:${nowTs()}:f>`
      );

      if (pendientes.size === 0) {
        return safeEdit(interaction, "✅ No hay pendientes de 5 días.");
      }

      return safeEdit(
        interaction,
        `📌 **Pendientes (5 días):** ${pendientes.size}\n\n${list.join("\n")}`
      );
    }

    // ===== /limpiar_pendientes =====
    if (interaction.commandName === "limpiar_pendientes") {
      await safeDefer(interaction);

      if (!(await invokerHasPermission(interaction))) {
        return safeEdit(interaction, "❌ No tienes permiso.");
      }

      // 🔒 Lock anti-spam
      const gid = interaction.guildId;
      if (limpiarLocks.get(gid)) {
        return safeEdit(interaction, "⏳ Ya hay una limpieza en proceso. Espera un momento y vuelve a intentar.");
      }
      limpiarLocks.set(gid, true);

      try {
        const confirmar = interaction.options.getBoolean("confirmar", true);
        await interaction.guild.members.fetch();

        const pendientes = getPendientes(interaction.guild);

        await sendLogSafe(
          interaction,
          `🧹 **/limpiar_pendientes usado**\n` +
            `👤 Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
            `📍 Canal: <#${interaction.channelId}>\n` +
            `⚙️ Confirmar: ${confirmar}\n` +
            `🔢 Pendientes detectados: ${pendientes.size}\n` +
            `🕒 Hora: <t:${nowTs()}:f>`
        );

        if (pendientes.size === 0) {
          return safeEdit(interaction, "✅ No hay nadie para expulsar.");
        }

        if (!confirmar) {
          return safeEdit(
            interaction,
            `⚠️ **Preview**: ${pendientes.size} personas serían expulsadas.\nUsa \`confirmar:true\` para ejecutar.`
          );
        }

        const me = await interaction.guild.members.fetchMe();
        if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          return safeEdit(interaction, "❌ No tengo permiso para expulsar (Kick Members).");
        }

        let kicked = 0;
        let failed = 0;

        for (const member of pendientes.values()) {
          try {
            if (member.kickable) {
              await member.kick("No verificada después de 5 días");
              kicked++;
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
            console.error("Kick falló para:", member.user?.tag, e?.message || e);
          }
        }

        await sendLogSafe(
          interaction,
          `✅ **Limpieza terminada**\n` +
            `👤 Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
            `🔢 Detectados: ${pendientes.size}\n` +
            `👢 Expulsados: ${kicked}\n` +
            `⚠️ Fallos/no kickable: ${failed}\n` +
            `🕒 Hora: <t:${nowTs()}:f>`
        );

        return safeEdit(interaction, `🧹 Limpieza completa: **${kicked}** personas expulsadas.`);
      } finally {
        limpiarLocks.set(interaction.guildId, false);
      }
    }
  } catch (err) {
    console.error("❌ Error en interactionCreate:", err?.message || err);

    try {
      if (interaction.isChatInputCommand()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({ content: "❌ Error interno del bot.", ephemeral: true });
        } else {
          await interaction.editReply("❌ Error interno del bot.");
        }
      }
    } catch (_) {}
  }
});

// ===== Anti-crash =====
process.on("unhandledRejection", (reason) => {
  console.error("❌ unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("❌ uncaughtException:", err);
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);

