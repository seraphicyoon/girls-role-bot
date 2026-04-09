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
}

function guardarVerificadas() {
  fs.writeFileSync(VERIF_DB_FILE, JSON.stringify(verificadas, null, 2), "utf8");
}

// ===== CONFIG =====
const NO_VERIFICADAS_ROLE_ID = "996592241260888095";
const GIRLS_ROLE_NAME = "﹒╴girls ღﾟ˚̣̣̣";

const allowedRoleIds = [
  "1447179100551905321",
  "1222199503873114175",
  "996585466197454929",
  "997485830341918730",
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
  .setDescription("Asigna el rol Girls")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuario").setRequired(true)
  );

const pendientesCommand = new SlashCommandBuilder()
  .setName("pendientes")
  .setDescription("Lista pendientes");

const limpiarCommand = new SlashCommandBuilder()
  .setName("limpiar_pendientes")
  .setDescription("Expulsa no verificadas")
  .addBooleanOption((o) =>
    o.setName("confirmar").setDescription("true/false").setRequired(true)
  );

const decirCommand = new SlashCommandBuilder()
  .setName("decir")
  .setDescription("Mensaje anónimo")
  .addStringOption((o) =>
    o.setName("mensaje").setDescription("Mensaje").setRequired(true)
  );

const bienvenidaCommand = new SlashCommandBuilder()
  .setName("bienvenida")
  .setDescription("Mensaje bienvenida")
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

// ===== REGISTER =====
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const commands = [
    verificarCommand,
    pendientesCommand,
    limpiarCommand,
    decirCommand,
    bienvenidaCommand,
    metodoFotoCommand,
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
  await registerCommands();
});

// ===== HELPERS =====
async function invokerHasPermission(interaction) {
  const invoker = await interaction.guild.members.fetch(interaction.user.id);
  return invoker.roles.cache.some((r) => allowedRoleIds.includes(r.id));
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // ===== DECIR =====
    if (interaction.commandName === "decir") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction)))
        return interaction.editReply("❌ No permiso");

      const msg = interaction.options.getString("mensaje");

      await interaction.channel.send({
        content: msg,
        allowedMentions: { parse: [] },
      });

      return interaction.editReply("✅ Enviado");
    }

    // ===== BIENVENIDA =====
    if (interaction.commandName === "bienvenida") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction)))
        return interaction.editReply("❌ No permiso");

      const user = interaction.options.getUser("usuario");

      const embed = new EmbedBuilder()
        .setColor("#F4A6C1")
        .setDescription(
          `Listo ${user} ya has sido verificada 💖\n\n` +
          `Ve a <#1097575701739216947>\n` +
          `Preséntate en <#989867122605817887>\n` +
          `Dudas en <#1252395723262001152>\n` +
          `Chat en <#989867080595701790>`
        );

      await interaction.channel.send({
        content: `${user}`,
        embeds: [embed],
        allowedMentions: { users: [user.id] },
      });

      return interaction.editReply("✅ Enviado");
    }

    // ===== METODO FOTO =====
    if (interaction.commandName === "metodo_foto") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction)))
        return interaction.editReply("❌ No permiso");

      const user = interaction.options.getUser("usuario");
      const gesto = interaction.options.getString("gesto");

      const embed = new EmbedBuilder()
        .setColor("#F4A6C1")
        .setTitle("📸 Método de verificación")
        .setDescription(
          `La foto debe tener el gesto ${gesto}\n\n` +
          `El audio debe incluir:\n` +
          `• Nombre de Discord\n` +
          `• Edad\n` +
          `• Pronombre (ella, él, elle)`
        );

      await interaction.channel.send({
        content: `${user}`,
        embeds: [embed],
        allowedMentions: { users: [user.id] },
      });

      return interaction.editReply("✅ Método enviado");
    }

    // ===== VERIFICAR =====
    if (interaction.commandName === "verificar") {
      await interaction.deferReply({ ephemeral: true });

      if (!(await invokerHasPermission(interaction)))
        return interaction.editReply("❌ No permiso");

      const member = interaction.options.getMember("usuario");
      const role = interaction.guild.roles.cache.find(
        (r) => r.name === GIRLS_ROLE_NAME
      );

      await member.roles.add(role);

      return interaction.editReply("✅ Verificada");
    }
  } catch (e) {
    console.error(e);
    interaction.reply({ content: "❌ Error", ephemeral: true });
  }
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);
