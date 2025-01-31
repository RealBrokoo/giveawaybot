const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const ms = require('ms');

const TOKEN = 'TOKEN';
const CLIENT_ID = 'CLIENT_ID';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Lance un giveaway')
            .addStringOption(option => option.setName('lot').setDescription('Le lot à gagner').setRequired(true))
            .addIntegerOption(option => option.setName('durée').setDescription('Durée en heures').setRequired(true))
            .addIntegerOption(option => option.setName('nombre_gagnants').setDescription('Nombre de gagnants').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('🔄 Déploiement des commandes...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Commande /giveaway enregistrée avec succès.');
    } catch (error) {
        console.error('❌ Erreur lors du déploiement de la commande:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'giveaway') {
        const lot = interaction.options.getString('lot');
        const durée = ms(`${interaction.options.getInteger('durée')}h`);
        const nombreGagnants = interaction.options.getInteger('nombre_gagnants');

        if (!lot || !durée || !nombreGagnants) {
            return interaction.reply({ content: "⚠️ Format incorrect: `/giveaway [lot] [durée en minutes] [nombre de gagnants]`", ephemeral: true });
        }

        const participants = new Set();

        const embed = new EmbedBuilder()
            .setTitle("🎰 GIVEAWAY")
            .setDescription(`🎁 **Lot:** ${lot}\n⌚ **Durée:** ${interaction.options.getInteger('durée')} minute(s)\n🥇 **Nombre de gagnants:** ${nombreGagnants}\n`)
            .setColor("Blue")
            .setFooter({ text: `Participants: 0` })
            .setTimestamp();

        const bouton = new ButtonBuilder()
            .setCustomId('participate')
            .setLabel('Participer')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(bouton);

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = message.createMessageComponentCollector({ time: durée });

        collector.on('collect', async i => {
            if (i.customId === 'participate') {
                if (participants.has(i.user.id)) {
                    return i.reply({ content: "⚠️ Vous êtes déjà inscrit au giveaway.", ephemeral: true });
                }

                participants.add(i.user.id);
                await i.reply({ content: "✅ Vous êtes inscrit au giveaway.", ephemeral: true });

                const updatedEmbed = EmbedBuilder.from(embed)
                    .setFooter({ text: `Participants: ${participants.size}` });

                await message.edit({ embeds: [updatedEmbed] });
            }
        });

        collector.on('end', async () => {
            const participantsArray = Array.from(participants);

            const disabledButton = ButtonBuilder.from(bouton).setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
            await message.edit({ components: [disabledRow] });

            if (participantsArray.length === 0) {
                return interaction.editReply({ content: "⚠️ Aucun participant, giveaway annulé.", components: [] });
            }

            let rouletteMessage = await interaction.followUp({ content: "🎰 **Sélection des gagnants...** 🎰", fetchReply: true });

            let timeElapsed = 0;
            const interval = setInterval(async () => {
                if (timeElapsed >= 30000) {
                    clearInterval(interval);
            
                    const winners = [];
                    for (let i = 0; i < Math.min(nombreGagnants, participantsArray.length); i++) {
                        const winner = participantsArray.splice(Math.floor(Math.random() * participantsArray.length), 1)[0];
                        winners.push(`<@${winner}>`);
                    }

                    const finalEmbed = EmbedBuilder.from(embed)
                        .setDescription(`🎁 **Lot:** ${lot}\n🥇 **Nombre de gagnants:** ${nombreGagnants}\n\n👑 **Gagnant(s):** ${winners.join(', ')}`)
                        .setColor("Gold")
                        .setFooter({ text: `Participants: ${participants.size}` });

                    await message.edit({ embeds: [finalEmbed] });
                    await rouletteMessage.edit(`👑 **Félicitations aux gagnants !** ${winners.join(', ')}`);
            
                } else {
                    const randomParticipant = participantsArray[Math.floor(Math.random() * participantsArray.length)];
                    if (randomParticipant) {
                        const emoji = ["🎰", "🟢", "🔴", "🎲"][Math.floor(Math.random() * 5)];
                        await rouletteMessage.edit(`${emoji} **Roulette en cours...** ${emoji} <@${randomParticipant}>`);
                    }
                    timeElapsed += 3000;
                }
            }, 3000);                    
        });
    }
});

client.login('TOKEN');