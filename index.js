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
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

// ===== SESIONES TEMPORALES DE PENDIENTES =====
const pendingSessions = new Map();
const PENDING_SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

function cleanupPendingSessions() {
  const now = Date.now();
  for (const [userId, session] of pendingSessions.entries()) {
    if (!session || now - session.createdAt > PENDING_SESSION_TTL_MS) {
      pendingSessions.delete(userId);
    }
  }
}

setInterval(cleanupPendingSessions, 5 * 60 * 1000);

// ===== COMMANDS =====
const verificarCommand = new SlashCommandBuilder()
  .setName("verificar")
  .setDescription("Asigna el rol Girls y quita no verificadas")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuario").setRequired(true)
  );

const pendientesCommand = new SlashCommandBuilder()
  .setName("pendientes")
  .setDescription("Lista personas con no verificadas desde hace 5 días");

const decirCommand = new SlashCommandBuilder()
  .setName("decir")
  .setDescription("Enviar un mensaje como el bot (anónimo)")
  .addStringOption((o) =>
    o.setName("mensaje").setDescription("Mensaje").setRequired(true)
  );

const bienvenidaCommand = new SlashCommandBuilder()
  .setName("bienvenida")
  .setDescription("Envía el mensaje de verificación/bienvenida a una usuaria")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuaria").setRequired(true)
  );

const metodoFotoCommand = new SlashCommandBuilder()
  .setName("metodo_foto")
  .setDescription("Método de verificación con foto")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuaria").setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("gesto")
      .setDescription("Gesto")
      .setRequired(true)
      .addChoices(
        { name: "🫰", value: "🫰" },
        { name: "☝️", value: "☝️" },
        { name: "👊", value: "👊" },
        { name: "👍", value: "👍" },
        { name: "👎", value: "👎" },
        { name: "👌", value: "👌" },
        { name: "🤌", value: "🤌" }
      )
  );

const ticketCommand = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Avisa cuántas horas quedan para finalizar el ticket")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuaria").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("horas").setDescription("Horas restantes").setRequired(true)
  );

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const commands = [
    verificarCommand,
    pendientesCommand,
    decirCommand,
    bienvenidaCommand,
    metodoFotoCommand,
    ticketCommand,
  ].map((c) => c.toJSON());

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [],
  });

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log("✅ Comandos listos");
}

client.once("ready", async () => {
  console.log(`🤖 ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (e) {
    console.error("❌ Error registrando comandos:", e);
  }

  if (!LOG_CHANNEL_ID) {
    console.log("⚠️ LOG_CHANNEL_ID no está configurado.");
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
  if (!LOG_CHANNEL_ID) return;

  try {
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;
    await logChannel.send({ content, allowedMentions: { parse: [] } });
  } catch (e) {
    console.error("❌ Error enviando log:", e);
  }
}

function extractUserIdFromInput(input) {
  if (!input) return null;
  const trimmed = input.trim();

  const mentionMatch = trimmed.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) return mentionMatch[1];

  const idMatch = trimmed.match(/^(\d{17,20})$/);
  if (idMatch) return idMatch[1];

  return null;
}

function buildPendingButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pendientes_expulsar")
        .setLabel("Expulsar")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✅")
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("pendientes_omitir")
        .setLabel("Omitir usuaria")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📝")
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("pendientes_cancelar")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("❌")
        .setDisabled(disabled)
    ),
  ];
}

function buildPendingEmbed(guild, session) {
  const pendientesData = session.pendingUserIds.map((userId) => {
    const member = guild.members.cache.get(userId);
    if (!member || !member.joinedAt) return null;

    const t = Math.floor(member.joinedAt.getTime() / 1000);
    const omitida = session.omitted[userId];

    if (omitida) {
      return `• ${member} — entró <t:${t}:R> — **OMITIDA**\n  Motivo: ${omitida.reason}`;
    }

    return `• ${member} — entró <t:${t}:R>`;
  }).filter(Boolean);

  const visibles = pendientesData.slice(0, 20);
  const omitidasCount = Object.keys(session.omitted).length;
  const expulsablesCount = session.pendingUserIds.length - omitidasCount;

  const extraLine =
    pendientesData.length > 20
      ? `\nY ${pendientesData.length - 20} más...`
      : "";

  const description =
    `**Pendientes encontradas:** ${session.pendingUserIds.length}\n` +
    `**Omitidas:** ${omitidasCount}\n` +
    `**Se expulsarán:** ${expulsablesCount}\n\n` +
    (visibles.length > 0 ? visibles.join("\n") : "No hay pendientes.") +
    extraLine +
    `\n\nUsa los botones de abajo para continuar.`;

  return new EmbedBuilder()
    .setColor("#F4A6C1")
    .setTitle("📌 Pendientes de verificación")
    .setDescription(description)
    .setFooter({ text: "Puedes omitir usuarias antes de expulsar." })
    .setTimestamp();
}

function buildDisabledPendingEmbed(title, description) {
  return new EmbedBuilder()
    .setColor("#F4A6C1")
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

const FETCH_COOLDOWN_MS = 5 * 60 * 1000;
let lastFetchAt = 0;
let fetchingPromise = null;

async function ensureMembersFetched(guild) {
  const now = Date.now();

  if (now - lastFetchAt < FETCH_COOLDOWN_MS) return;
  if (fetchingPromise) return fetchingPromise;

  fetchingPromise = (async () => {
    try {
      await guild.members.fetch();
      lastFetchAt = Date.now();
    } finally {
      fetchingPromise = null;
    }
  })();

  return fetchingPromise;
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  try {
    // =========================
    // SLASH COMMANDS
    // =========================
    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild()) return;

      // ===== DECIR =====
      if (interaction.commandName === "decir") {
        await interaction.deferReply({ ephemeral: true });

        if (!(await invokerHasPermission(interaction))) {
          return interaction.editReply("❌ No tienes permiso.");
        }

        const msg = interaction.options.getString("mensaje", true);

        if (msg.includes("@everyone") || msg.includes("@here")) {
          return interaction.editReply("❌ No se permite @everyone/@here.");
        }

        const sentMessage = await interaction.channel.send({
          content: msg,
          allowedMentions: { parse: [] },
        });

        const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;
        await sendLog(
          interaction,
          `📝 **/decir usado**\nUsuario: ${interaction.user.tag}\nCanal: <#${interaction.channelId}>\nLink: ${jumpLink}\nMensaje: ${msg}`
        );

        return interaction.editReply("✅ Enviado");
      }

      // ===== BIENVENIDA =====
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

        const embed = new EmbedBuilder()
          .setColor("#F4A6C1")
          .setDescription(
            `Listo ${user} ya has sido verificada, espero y disfrutes tu estancia en el servidor <:01_lumi_corazon:1435352473543114832>\n\n` +
            `Te invito a pasarte por <#${ROLES_CH}> para llenar datos de tu perfil <:00_lumi_aww:1433442969662263427>\n` +
            `Te esperamos con tu <#${PRESENTACION_CH}> para conocerte mejor‼️\n` +
            `Si tienes dudas o sugerencias puedes dejarlas por aquí <#${DUDAS_CH}>\n` +
            `Ven a saludar y platicar con nosotros en <#${CHARLA_CH}> <:00_lumi_corazon:1433443102189813771>`
          );

        const sentMessage = await interaction.channel.send({
          content: `${user}`,
          embeds: [embed],
          allowedMentions: { users: [user.id] },
        });

        const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;
        await sendLog(
          interaction,
          `💌 **/bienvenida usado**\nStaff: ${interaction.user.tag} (${interaction.user.id})\nUsuaria: ${user.tag} (${user.id})\nCanal: <#${interaction.channelId}>\nLink: ${jumpLink}`
        );

        return interaction.editReply("✅ Bienvenida enviada.");
      }

      // ===== METODO FOTO =====
      if (interaction.commandName === "metodo_foto") {
        await interaction.deferReply({ ephemeral: true });

        if (!(await invokerHasPermission(interaction))) {
          return interaction.editReply("❌ No tienes permiso.");
        }

        const user = interaction.options.getUser("usuario", true);
        const gesto = interaction.options.getString("gesto", true);

        const embed = new EmbedBuilder()
          .setColor("#F4A6C1")
          .setTitle("POR FAVOR DE HACER LO SIGUIENTE CORRECTAMENTE")
          .setDescription(
            `La foto tiene que tener el gesto ${gesto}\n\n` +
            `El audio debe incluir:\n` +
            `• Nombre de Discord\n` +
            `• Edad\n` +
            `• Pronombre (ella, él, elle)`
          );

        const sentMessage = await interaction.channel.send({
          content: `${user}`,
          embeds: [embed],
          allowedMentions: { users: [user.id] },
        });

        const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;
        await sendLog(
          interaction,
          `📸 **/metodo_foto usado**\nStaff: ${interaction.user.tag} (${interaction.user.id})\nUsuaria: ${user.tag} (${user.id})\nGesto elegido: ${gesto}\nCanal: <#${interaction.channelId}>\nLink: ${jumpLink}`
        );

        return interaction.editReply("✅ Método enviado");
      }

      // ===== TICKET =====
      if (interaction.commandName === "ticket") {
        await interaction.deferReply({ ephemeral: true });

        if (!(await invokerHasPermission(interaction))) {
          return interaction.editReply("❌ No tienes permiso.");
        }

        const user = interaction.options.getUser("usuario", true);
        const horas = interaction.options.getInteger("horas", true);

        if (horas <= 0) {
          return interaction.editReply("❌ Las horas deben ser mayor a 0.");
        }

        const textoHoras = horas === 1 ? "hora" : "horas";

        const sentMessage = await interaction.channel.send({
          content:
            `${user} tu ticket finalizará en ${horas} ${textoHoras}. Por favor, responde con brevedad.\n` +
            `Recuerda que nuestro bot expulsa a las usuarias con más de 5 días de inactividad, pero puedes volver a unirte al servidor y realizar nuevamente tu verificación.`,
          allowedMentions: { users: [user.id] },
        });

        const jumpLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${sentMessage.id}`;

        await sendLog(
          interaction,
          `⏰ **/ticket usado**\nStaff: ${interaction.user.tag} (${interaction.user.id})\nUsuaria: ${user.tag} (${user.id})\nHoras: ${horas}\nCanal: <#${interaction.channelId}>\nLink: ${jumpLink}`
        );

        return interaction.editReply("✅ Aviso de ticket enviado.");
      }

      // ===== VERIFICAR =====
      if (interaction.commandName === "verificar") {
        await interaction.deferReply({ ephemeral: true });

        if (!(await invokerHasPermission(interaction))) {
          return interaction.editReply("❌ No tienes permiso.");
        }

        const member = interaction.options.getMember("usuario");
        const role = interaction.guild.roles.cache.find(
          (r) => r.name === GIRLS_ROLE_NAME
        );

        if (!member || !role) {
          return interaction.editReply("❌ No pude encontrar al usuario o el rol.");
        }

        const me = await interaction.guild.members.fetchMe();

        if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return interaction.editReply("❌ No tengo permiso para administrar roles.");
        }

        if (me.roles.highest.position <= role.position) {
          return interaction.editReply("❌ Mi rol debe estar arriba del rol Girls.");
        }

        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role);
        }

        if (member.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) {
          await member.roles.remove(NO_VERIFICADAS_ROLE_ID);
        }

        verificadas[member.id] = {
          verificadaPor: interaction.user.id,
          verificadaPorTag: interaction.user.tag,
          fecha: new Date().toISOString(),
        };
        guardarVerificadas();

        await sendLog(
          interaction,
          `✅ **/verificar usado** por ${interaction.user.tag} a ${member.user.tag}`
        );

        return interaction.editReply("✅ Verificada");
      }

      // ===== PENDIENTES =====
      if (interaction.commandName === "pendientes") {
        await interaction.deferReply({ ephemeral: true });

        if (!(await invokerHasPermission(interaction))) {
          return interaction.editReply("❌ No tienes permiso.");
        }

        await ensureMembersFetched(interaction.guild);

        const pendientes = interaction.guild.members.cache.filter((m) => {
          if (m.user.bot) return false;
          if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
          if (!m.joinedAt) return false;
          return m.joinedAt.getTime() <= Date.now() - 5 * 24 * 60 * 60 * 1000;
        });

        if (pendientes.size === 0) {
          return interaction.editReply({
            embeds: [
              buildDisabledPendingEmbed(
                "📌 Pendientes de verificación",
                "✅ No hay pendientes de 5 días."
              ),
            ],
            components: [],
          });
        }

        const orderedIds = [...pendientes.values()]
          .sort((a, b) => a.joinedAt - b.joinedAt)
          .map((m) => m.id);

        const session = {
          createdAt: Date.now(),
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          staffUserId: interaction.user.id,
          pendingUserIds: orderedIds,
          omitted: {},
        };

        pendingSessions.set(interaction.user.id, session);

        await sendLog(
          interaction,
          `📌 **/pendientes usado**\nStaff: ${interaction.user.tag}\nEncontradas: ${orderedIds.length}`
        );

        return interaction.editReply({
          embeds: [buildPendingEmbed(interaction.guild, session)],
          components: buildPendingButtons(false),
        });
      }
    }

    // =========================
    // BUTTONS
    // =========================
    if (interaction.isButton()) {
      if (!interaction.inGuild()) return;

      const session = pendingSessions.get(interaction.user.id);

      if (!session) {
        return interaction.reply({
          content: "❌ Ya no hay una sesión activa. Usa `/pendientes` otra vez.",
          ephemeral: true,
        });
      }

      if (session.staffUserId !== interaction.user.id) {
        return interaction.reply({
          content: "❌ Esta sesión no es tuya.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "pendientes_cancelar") {
        pendingSessions.delete(interaction.user.id);

        return interaction.update({
          embeds: [
            buildDisabledPendingEmbed(
              "❌ Limpieza cancelada",
              "La operación fue cancelada. Usa `/pendientes` otra vez si quieres revisar la lista."
            ),
          ],
          components: buildPendingButtons(true),
        });
      }

      if (interaction.customId === "pendientes_omitir") {
        const modal = new ModalBuilder()
          .setCustomId("pendientes_omitir_modal")
          .setTitle("Omitir usuaria de la limpieza");

        const userInput = new TextInputBuilder()
          .setCustomId("omit_user")
          .setLabel("ID o mención de la usuaria")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("@usuaria o 123456789012345678")
          .setRequired(true)
          .setMaxLength(50);

        const reasonInput = new TextInputBuilder()
          .setCustomId("omit_reason")
          .setLabel("¿Por qué quieres omitirla?")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Ejemplo: ya avisó, está en proceso, error del sistema...")
          .setRequired(true)
          .setMaxLength(400);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "pendientes_expulsar") {
        await interaction.deferUpdate();

        await ensureMembersFetched(interaction.guild);

        const me = await interaction.guild.members.fetchMe();
        if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          return interaction.editReply({
            embeds: [
              buildDisabledPendingEmbed(
                "❌ No pude expulsar",
                "No tengo permiso para expulsar miembros."
              ),
            ],
            components: buildPendingButtons(true),
          });
        }

        const excludedIds = Object.keys(session.omitted);
        const toKickIds = session.pendingUserIds.filter((id) => !excludedIds.includes(id));

        let kicked = 0;
        let failed = 0;
        const kickedTags = [];
        const failedTags = [];

        for (const userId of toKickIds) {
          const member = interaction.guild.members.cache.get(userId);
          if (!member) {
            failed++;
            failedTags.push(`ID ${userId} (no encontrado)`);
            continue;
          }

          try {
            if (member.kickable) {
              await member.kick("No verificada después de 5 días");
              kicked++;
              kickedTags.push(`${member.user.tag} (${member.id})`);
              await sleep(1500);
            } else {
              failed++;
              failedTags.push(`${member.user.tag} (${member.id})`);
            }
          } catch (e) {
            failed++;
            failedTags.push(`${member.user.tag} (${member.id})`);
            await sleep(1500);
          }
        }

        const omittedLines = Object.entries(session.omitted).map(([userId, info]) => {
          return `• ${info.tag} (${userId}) — ${info.reason}`;
        });

        await sendLog(
          interaction,
          `🧹 **Limpieza de pendientes ejecutada**\n` +
            `Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
            `Pendientes detectadas: ${session.pendingUserIds.length}\n` +
            `Omitidas: ${excludedIds.length}\n` +
            `Expulsadas: ${kicked}\n` +
            `Fallidas: ${failed}` +
            (omittedLines.length
              ? `\n\n**Usuarias omitidas:**\n${omittedLines.join("\n")}`
              : "") +
            (kickedTags.length
              ? `\n\n**Expulsadas:**\n${kickedTags.map((x) => `• ${x}`).join("\n")}`
              : "") +
            (failedTags.length
              ? `\n\n**No expulsadas:**\n${failedTags.map((x) => `• ${x}`).join("\n")}`
              : "")
        );

        pendingSessions.delete(interaction.user.id);

        return interaction.editReply({
          embeds: [
            buildDisabledPendingEmbed(
              "🧹 Limpieza completada",
              `**Expulsadas:** ${kicked}\n` +
                `**Omitidas:** ${excludedIds.length}\n` +
                `**Fallidas:** ${failed}` +
                (omittedLines.length
                  ? `\n\n**Omitidas:**\n${omittedLines.join("\n")}`
                  : "")
            ),
          ],
          components: buildPendingButtons(true),
        });
      }
    }

    // =========================
    // MODALS
    // =========================
    if (interaction.isModalSubmit()) {
      if (!interaction.inGuild()) return;

      if (interaction.customId === "pendientes_omitir_modal") {
        const session = pendingSessions.get(interaction.user.id);

        if (!session) {
          return interaction.reply({
            content: "❌ Ya no hay una sesión activa. Usa `/pendientes` otra vez.",
            ephemeral: true,
          });
        }

        const rawUser = interaction.fields.getTextInputValue("omit_user");
        const reason = interaction.fields.getTextInputValue("omit_reason").trim();
        const userId = extractUserIdFromInput(rawUser);

        if (!userId) {
          return interaction.reply({
            content: "❌ No pude leer ese usuario. Escribe su mención o su ID.",
            ephemeral: true,
          });
        }

        if (!session.pendingUserIds.includes(userId)) {
          return interaction.reply({
            content: "❌ Esa usuaria no está en la lista actual de pendientes.",
            ephemeral: true,
          });
        }

        const member = interaction.guild.members.cache.get(userId) ||
          await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: "❌ No pude encontrar a esa usuaria en el servidor.",
            ephemeral: true,
          });
        }

        session.omitted[userId] = {
          reason,
          tag: member.user.tag,
          by: interaction.user.id,
          at: new Date().toISOString(),
        };

        pendingSessions.set(interaction.user.id, session);

        await sendLog(
          interaction,
          `📝 **Usuaria omitida de limpieza**\n` +
            `Staff: ${interaction.user.tag} (${interaction.user.id})\n` +
            `Usuaria: ${member.user.tag} (${member.id})\n` +
            `Motivo: ${reason}`
        );

        return interaction.reply({
          embeds: [buildPendingEmbed(interaction.guild, session)],
          components: buildPendingButtons(false),
          ephemeral: true,
        });
      }
    }
  } catch (e) {
    console.error(e);

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Error interno del bot.").catch(() => {});
      } else {
        await interaction.reply({ content: "❌ Error interno del bot.", ephemeral: true }).catch(() => {});
      }
    }
  }
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);
