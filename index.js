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

// Roles
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";

// Quienes pueden usar comandos (IDs)
const allowedRoleIds = [
  "1447179100551905321", // Admin
  "1222199503873114175", // Mod
  "996585466197454929",  // Helper
  "997485830341918730",  // Owner
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// /girls
const girlsCommand = new SlashCommandBuilder()
  .setName("girls")
  .setDescription("Asigna el rol Girls al usuario indicado")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuario al que se le asignará el rol")
      .setRequired(true)
  );

// /pendientes (5+ días)
const pendientesCommand = new SlashCommandBuilder()
  .setName("pendientes")
  .setDescription("Lista personas con 'no verificadas' desde hace 5+ días");

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [girlsCommand.toJSON(), pendientesCommand.toJSON()],
  });
}

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

function invokerHasPermission(interaction) {
  const invoker = interaction.member;
  return invoker?.roles?.cache?.some((r) => allowedRoleIds.includes(r.id));
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // =========================
  // /pendientes (5+ días)
  // =========================
  if (interaction.commandName === "pendientes") {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (!invokerHasPermission(interaction)) {
        return interaction.editReply("❌ No tienes permiso para usar este comando.");
      }

      const cutoffMs = 5 * 24 * 60 * 60 * 1000; // 5 días
      const cutoffDate = new Date(Date.now() - cutoffMs);

      await interaction.guild.members.fetch();

      const pendientes = interaction.guild.members.cache.filter((m) => {
        if (m.user.bot) return false;
        if (!m.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) return false;
        if (!m.joinedAt) return false;
        return m.joinedAt <= cutoffDate; // 5 o más días
      });

      if (pendientes.size === 0) {
        return interaction.editReply("✅ No hay personas con **no verificadas** desde hace 5+ días.");
      }

      const sorted = [...pendientes.values()].sort((a, b) => a.joinedAt - b.joinedAt);

      const maxShow = 40;
      const lines = sorted.slice(0, maxShow).map((m, i) => {
        const joinedTs = Math.floor(m.joinedAt.getTime() / 1000);
        return `${i + 1}. ${m} — entró <t:${joinedTs}:R>`;
      });

      let msg =
        `📌 **Pendientes (5+ días con no verificadas):** ${pendientes.size}\n\n` +
        lines.join("\n");

      if (pendientes.size > maxShow) {
        msg += `\n\n…y ${pendientes.size - maxShow} más.`;
      }

      return interaction.editReply(msg);
    } catch (err) {
      console.error(err);
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ content: "❌ Error generando la lista. Revisa logs.", ephemeral: true });
      }
      return interaction.editReply("❌ Error generando la lista. Revisa logs.");
    }
  }

  // =========================
  // /girls
  // =========================
  if (interaction.commandName === "girls") {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (!invokerHasPermission(interaction)) {
        return interaction.editReply("❌ No tienes permiso para usar este comando.");
      }

      const member = interaction.options.getMember("usuario");
      if (!member) {
        return interaction.editReply("❌ No pude obtener al usuario. Intenta otra vez.");
      }

      const girlsRole = interaction.guild.roles.cache.find((r) => r.name === GIRLS_ROLE_NAME);
      if (!girlsRole) {
        return interaction.editReply(`❌ No existe el rol **${GIRLS_ROLE_NAME}**.`);
      }

      const noVerRole = interaction.guild.roles.cache.get(NO_VERIFICADAS_ROLE_ID);
      const me = await interaction.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply("❌ No tengo permiso **Manage Roles**.");
      }

      if (me.roles.highest.position <= girlsRole.position) {
        return interaction.editReply("❌ Mi rol debe estar **arriba** del rol Girls.");
      }
      if (noVerRole && me.roles.highest.position <= noVerRole.position) {
        return interaction.editReply("❌ Mi rol debe estar **arriba** del rol no verificadas.");
      }

      if (member.roles.cache.has(girlsRole.id)) {
        return interaction.editReply("ℹ️ Ese usuario ya tiene el rol Girls.");
      }

      await member.roles.add(girlsRole);

      if (member.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) {
        await member.roles.remove(NO_VERIFICADAS_ROLE_ID);
      }

      return interaction.editReply(
        `✅ Listo: asigné **Girls** a ${member} y quité **no verificadas** (si lo tenía).`
      );
    } catch (err) {
      console.error(err);
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ content: "❌ Error interno del bot. Revisa logs en Railway.", ephemeral: true });
      }
      return interaction.editReply("❌ Error interno del bot. Revisa logs en Railway.");
    }
  }
});

client.login(DISCORD_TOKEN);
