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

// ===== CONFIG =====
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";

// Roles que pueden usar los comandos
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
  .addUserOption(option =>
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
  .addBooleanOption(option =>
    option
      .setName("confirmar")
      .setDescription("⚠️ true = expulsar | false = solo preview")
      .setRequired(true)
  );

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [girlsCommand, pendientesCommand, limpiarCommand].map(c => c.toJSON()) }
  );
}

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

// ===== HELPERS =====
function invokerHasPermission(interaction) {
  return interaction.member.roles.cache.some(r =>
    allowedRoleIds.includes(r.id)
  );
}

function getPendientes(guild) {
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - FIVE_DAYS;

  return guild.members.cache.filter(m => {
    if (m.user.bot) return false;
    if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
    if (!m.joinedAt) return false;
    return m.joinedAt.getTime() <= cutoff;
  });
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ===== /girls =====
  if (interaction.commandName === "girls") {
    await interaction.deferReply({ ephemeral: true });

    if (!invokerHasPermission(interaction)) {
      return interaction.editReply("❌ No tienes permiso.");
    }

    const member = interaction.options.getMember("usuario");
    const girlsRole = interaction.guild.roles.cache.find(
      r => r.name === GIRLS_ROLE_NAME
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

    if (!invokerHasPermission(interaction)) {
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

    if (!invokerHasPermission(interaction)) {
      return interaction.editReply("❌ No tienes permiso.");
    }

    const confirmar = interaction.options.getBoolean("confirmar");
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
      } catch {}
    }

    return interaction.editReply(
      `🧹 Limpieza completa: **${kicked}** personas expulsadas.`
    );
  }
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);
