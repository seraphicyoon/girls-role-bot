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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const command = new SlashCommandBuilder()
  .setName("girls")
  .setDescription("Asigna el rol Girls al usuario indicado")
  .addUserOption((option) =>
    option
      .setName("usuario")
      .setDescription("Usuario al que se le asignará el rol")
      .setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [command.toJSON()],
  });
}

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "girls") return;

  try {
    // ✅ Responde rápido para evitar "La aplicación no respondió"
    await interaction.deferReply({ ephemeral: true });

    // ✅ Solo Admin / Mod / Helper / Owner (por ID)
    const allowedRoleIds = [
      "1447179100551905321", // Admin
      "1222199503873114175", // Mod
      "996585466197454929",  // Helper
      "997485830341918730",  // Owner
    ];

    const invoker = interaction.member;
    const hasAllowedRole = invoker.roles.cache.some((r) =>
      allowedRoleIds.includes(r.id)
    );

    if (!hasAllowedRole) {
      return interaction.editReply("❌ No tienes permiso para usar este comando.");
    }

    // ✅ Usuario objetivo
    const member = interaction.options.getMember("usuario");
    if (!member) {
      return interaction.editReply("❌ No pude obtener al usuario. Intenta otra vez.");
    }

    // ✅ Rol Girls (por nombre exacto)
    const girlsRole = interaction.guild.roles.cache.find(
      (r) => r.name === "﹒╴girls ღﾟ˚̣̣̣"
    );
    if (!girlsRole) {
      return interaction.editReply("❌ No existe el rol **﹒╴girls ღﾟ˚̣̣̣**.");
    }

    // ✅ Rol "no verificadas" (por ID)
    const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
    const noVerRole = interaction.guild.roles.cache.get(NO_VERIFICADAS_ROLE_ID);

    // ✅ Permisos y jerarquía del bot (más confiable que members.me)
    const me = await interaction.guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.editReply("❌ No tengo permiso **Manage Roles**.");
    }

    // El rol más alto del bot debe estar arriba de Girls
    if (me.roles.highest.position <= girlsRole.position) {
      return interaction.editReply("❌ Mi rol debe estar **arriba** del rol Girls.");
    }

    // Y también arriba de "no verificadas" (si existe)
    if (noVerRole && me.roles.highest.position <= noVerRole.position) {
      return interaction.editReply("❌ Mi rol debe estar **arriba** del rol no verificadas.");
    }

    if (member.roles.cache.has(girlsRole.id)) {
      return interaction.editReply("ℹ️ Ese usuario ya tiene el rol Girls.");
    }

    // 1) Asignar Girls
    await member.roles.add(girlsRole);

    // 2) Quitar "no verificadas" si lo tiene
    if (member.roles.cache.has(NO_VERIFICADAS_ROLE_ID)) {
      await member.roles.remove(NO_VERIFICADAS_ROLE_ID);
    }

    // ✅ Respuesta final
    return interaction.editReply(
      `✅ Listo: asigné **Girls** a ${member} y quité **no verificadas** (si lo tenía).`
    );
  } catch (err) {
    console.error(err);

    // Si por alguna razón no se alcanzó a deferReply
    if (!interaction.deferred && !interaction.replied) {
      return interaction.reply({
        content: "❌ Error interno del bot. Revisa logs en Railway.",
        ephemeral: true,
      });
    }

    return interaction.editReply("❌ Error interno del bot. Revisa logs en Railway.");
  }
});

// ✅ Login UNA sola vez, al final del archivo
client.login(DISCORD_TOKEN);
