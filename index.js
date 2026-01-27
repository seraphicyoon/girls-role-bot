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
    return m.joinedAt.getTime() <= cutoff;
  });
}

// ✅ manda log y si falla, regresa el error (para mostrártelo)
async function sendLog(interaction, content) {
  if (!LOG_CHANNEL_ID) return { ok: false, error: "LOG_CHANNEL_ID no configurado" };

  try {
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);

    if (!logChannel) return { ok: false, error: "No se encontró el canal de logs" };
    if (!logChannel.isTextBased()) return { ok: false, error: "El canal de logs no es de texto" };

    await logChannel.send({ content, allowedMentions: { parse: [] } });
    return { ok: true };
  } catch (e) {
    console.error("❌ Error enviando log:", e);
    return { ok: false, error: e?.code || e?.message || "Error desconocido" };
  }
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;

    // ===== /say =====
    if (interaction.commandName === "say") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const texto = interaction.options.getString("mensaje", true);

      // bloquear everyone/here
      if (texto.includes("@everyone") || texto.includes("@here")) {
        return interaction.editReply("❌ No se permite usar @everyone/@here con /say.");
      }

      // 1) enviar al canal público (anónimo)
      const sentMessage = await interaction.channel.send({
        content: texto,
        allowedMentions: { parse: [] },
      });

      const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;

      // 2) log privado
      const logText =
        `📝 **/say usado**\n` +
        `👤 Usuario: ${interaction.user.tag} (${interaction.user.id})\n` +
        `📍 Canal: <#${interaction.channelId}>\n` +
        `🔗 Link: ${jumpLink}\n` +
        `🕒 Hora: <t:${Math.floor(Date.now() / 1000)}:f>\n` +
        `💬 Mensaje:\n>>> ${texto}`;

      const res = await sendLog(interaction, logText);

      // ✅ si falló, te aviso en privado para que no andes a ciegas
      if (!res.ok) {
        await interaction.followUp({
          content: `⚠️ El mensaje se envió, pero NO pude mandar el log a #log-lumi. Error: **${res.error}**`,
          ephemeral: true,
        });
      }

      return interaction.editReply("✅ Mensaje enviado.");
    }

    // ===== /girls =====
    if (interaction.commandName === "girls") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const member = interaction.options.getMember("usuario");
      const girlsRole = interaction.guild.roles.cache.find(
        (r) => r.name === GIRLS_ROLE_NAME
      );

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

      await interaction.guild.members.fetch();
      const pendientes = getPendientes(interaction.guild);

      if (pendientes.size === 0) {
        return interaction.editReply("✅ No hay pendientes de 5 días.");
      }

      const list = [...pendientes.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((m, i) => {
          const t = Math.floor(m.joinedAt.getTime() / 1000);
          return `${i + 1}. ${m} — entró <t:${t}:R>`;
        });

      return interaction.editReply(
        `📌 **Pendientes (5 días):** ${pendientes.size}\n\n${list.join("\n")}`
      );
    }

    // ===== /limpiar_pendientes =====
    if (interaction.commandName === "limpiar_pendientes") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction))) {
        return interaction.editReply("❌ No tienes permiso.");
      }

      const confirmar = interaction.options.getBoolean("confirmar", true);
      await interaction.guild.members.fetch();

      const pendientes = getPendientes(interaction.guild);

      if (pendientes.size === 0) {
        return interaction.editReply("✅ No hay nadie para expulsar.");
      }

      if (!confirmar) {
        return interaction.editReply(
          `⚠️ **Preview**: ${pendientes.size} personas serían expulsadas.\nUsa \`confirmar:true\` para ejecutar.`
        );
      }

      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return interaction.editReply("❌ No tengo permiso para expulsar.");
      }

      let kicked = 0;

      for (const member of pendientes.values()) {
        try {
          if (member.kickable) {
            await member.kick("No verificada después de 5 días");
            kicked++;
          }
        } catch (e) {
          console.error("Kick falló para:", member.user?.tag, e);
        }
      }

      return interaction.editReply(
        `🧹 Limpieza completa: **${kicked}** personas expulsadas.`
      );
    }
  } catch (err) {
    console.error("❌ Error en interactionCreate:", err);

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
