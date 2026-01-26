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
  .addUserOption(option =>
    option
      .setName("usuario")
      .setDescription("Usuario al que se le asignará el rol")
      .setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: [command.toJSON()] }
  );
}

client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "girls") return;
  
   // ✅ Solo Admin / Mod / Helper / Owner (por ID)
  const allowedRoleIds = [
    "1447179100551905321", // Admin
    "1222199503873114175", // Mod
    "996585466197454929",  // Helper
    "997485830341918730",  // Owner
  ];

  const invoker = interaction.member;

  const hasAllowedRole = invoker.roles.cache.some(role =>
    allowedRoleIds.includes(role.id)
  );

  if (!hasAllowedRole) {
    return interaction.reply({
      content: "❌ No tienes permiso para usar este comando.",
      ephemeral: true,
    });
  }

  // ⬇️ TU CÓDIGO ORIGINAL (NO SE BORRA)

  const member = interaction.options.getMember("usuario");
  const role = interaction.guild.roles.cache.find(
  r => r.name === "﹒╴girls ღﾟ˚̣̣̣"
);


  if (!role) {
    return interaction.reply({ content: "❌ No existe el rol **Girls**", ephemeral: true });
  }

  if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.reply({ content: "❌ No tengo permiso para gestionar roles", ephemeral: true });
  }

  if (interaction.guild.members.me.roles.highest.position <= role.position) {
    return interaction.reply({
      content: "❌ Mi rol debe estar **arriba** del rol Girls",
      ephemeral: true,
    });
  }

  if (member.roles.cache.has(role.id)) {
    return interaction.reply({ content: "ℹ️ Ese usuario ya tiene el rol Girls", ephemeral: true });
  }

  await member.roles.add(role);
  interaction.reply(`✅ Rol **Girls** asignado a ${member}`);
});

client.login(DISCORD_TOKEN);
