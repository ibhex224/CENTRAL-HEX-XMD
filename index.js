const { webcrypto } = require('crypto');
global.crypto = webcrypto;

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');
const pino = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

// ════════════════════════════════════════
//   CONFIG
// ════════════════════════════════════════
const app      = express();
const PORT     = process.env.PORT || 3000;
const BOT_NAME = 'CENTRAL-HEX-XDM';
const CREATOR  = 'Ibrahima Sory Sacko';
const CONTACT  = '+224 666 95 29 49';
const PREFIX   = '.';
const BOT_IMG  = 'https://i.ibb.co/sp7vYJt5/1772381137526.png';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionCache   = new NodeCache({ stdTTL: 300 });
const activeSessions = new Map();
const startTime      = Date.now();
const logger         = pino({ level: 'silent' });

if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions');

// ════════════════════════════════════════
//   MENU .help
// ════════════════════════════════════════
function buildHelpMenu() {
  return `╔════════════════╗
║   CENTRAL-HEX-XDM    ║
║   by Ibsacko 🥷CHX🇬🇳 ║
╚═══════════════════╝

╭━〔 GESTION DE GROUPE 〕━┈⊷
┃✰│kick ➫ Exclure un membre
┃✰│add ➫ Ajouter un numéro
┃✰│promote ➫ Promouvoir admin
┃✰│demote ➫ Retirer admin
┃✰│tagall ➫ Mentionner tous
┃✰│hidetag ➫ Mention cachée
┃✰│groupname ➫ Changer le nom
┃✰│groupdesc ➫ description
┃✰│open ➫ Ouvrir le groupe
┃✰│close ➫ Fermer le groupe
╰━━━━━━━━━━━━━━━┈⊷

╭━〔 SÉCURITÉ & MODÉRATION 〕━┈⊷
┃✰│antilink ➫ Bloquer liens
┃✰│antispam ➫ Anti spam
┃✰│warn ➫ Avertir membre
┃✰│unwarn ➫ avertissement
┃✰│warnings ➫ Voir les warns
┃✰│ban ➫ Bannir membre
┃✰│mute ➫ Mode silencieux
┃✰│unmute ➫ Réactiver messages
╰━━━━━━━━━━━━━━━┈⊷

╭━〔 JEUX & DIVERTISSEMENT 〕━┈⊷
┃✰│quiz ➫ Quiz aléatoire
┃✰│quizscore ➫ Voir score
┃✰│jeu pile ➫ Pile ou face
┃✰│blague ➫ Blague aléatoire
┃✰│8ball ➫ Réponse magique
┃✰│love ➫ % d'amour
╰━━━━━━━━━━━━━━━┈⊷

╭━━〔 TÉLÉCHARGEMENT 〕━┈⊷
┃✰│yt ➫ Télécharger YouTube
┃✰│tiktok ➫ Télécharger TikTok
┃✰│ig ➫ Télécharger Instagram
┃✰│fb ➫ Télécharger Facebook
┃✰│mp3 ➫ Audio YouTube
╰━━━━━━━━━━━━━━━┈⊷

╭━━〔 UTILITAIRES 〕━━┈⊷
┃✰│help ➫ Liste commandes
┃✰│stats ➫ Statistiques bot
┃✰│ping ➫ Vitesse du bot
┃✰│sticker ➫ Img en sticker
┃✰│toimg ➫ Sticker en image
┃✰│time ➫ Heure actuelle
┃✰│info ➫ Infos du bot
╰━━━━━━━━━━━━━━━┈⊷

👤 *Créateur :* ${CREATOR} 🇬🇳
📱 *Contact  :* ${CONTACT}
⚡ *Préfixe  :* ${PREFIX}`;
}

// ════════════════════════════════════════
//   QUIZ DATA
// ════════════════════════════════════════
const QUIZ_QUESTIONS = [
  { q: '🎌 Dans quel anime apparaît Naruto Uzumaki ?',     r: 'naruto' },
  { q: '⚔️ Quel est le nom du titan fondateur dans AoT ?', r: 'ymir' },
  { q: '🌊 Qui est le capitaine du Chapeau de Paille ?',    r: 'luffy' },
  { q: '⚡ Pokémon de départ feu de Kanto ?',               r: 'salamèche' },
  { q: '🃏 Quel est le surnom de Killua Zoldyck ?',         r: 'kil' },
  { q: '🔥 Comment s\'appelle l\'épée de Demon Slayer ?',   r: 'nichirin' },
  { q: '💀 Quel est le fruit du diable de Luffy ?',         r: 'gomu gomu' },
  { q: '🧪 Dans quel anime Levi Ackerman apparaît-il ?',    r: 'attack on titan' },
  { q: '🌙 Quel est le vrai nom de Sailor Moon ?',          r: 'usagi' },
  { q: '🐉 Comment s\'appelle le dragon de Natsu ?',        r: 'igneel' },
];

const quizScores  = new Map();
const pendingQuiz = new Map();

// ════════════════════════════════════════
//   CRÉER UNE SESSION BOT
// ════════════════════════════════════════
async function createSession(phoneNumber, sessionId) {
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ['Ubuntu', 'Chrome', '120.0.0'],
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  // ════════════════════════════════════
  //   ✅ PAIRING CODE — BONNE MÉTHODE
  //   Appelé juste après création socket
  //   PAS dans connection.update
  // ════════════════════════════════════
  if (!sock.authState.creds.registered) {
    // Attendre que le socket soit prêt
    await new Promise(r => setTimeout(r, 3000));
    try {
      // Numéro propre : chiffres seulement
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      console.log(`📱 Demande pairing code pour: ${cleanNumber}`);

      const code = await sock.requestPairingCode(cleanNumber);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      sessionCache.set(sessionId, {
        code: formattedCode,
        status: 'pending',
        phone: cleanNumber
      });
      console.log(`✅ Pairing code: ${formattedCode}`);
    } catch (err) {
      console.error('❌ Erreur pairing:', err.message);
      sessionCache.set(sessionId, {
        code: null,
        status: 'error',
        error: err.message
      });
    }
  }

  // ════════════════════════════════════
  //   CONNEXION
  // ════════════════════════════════════
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

    if (connection === 'open') {
      console.log(`🟢 Bot connecté !`);
      activeSessions.set(sessionId, sock);
      sessionCache.set(sessionId, { status: 'connected', phone: phoneNumber });

      const cleanJID = phoneNumber.replace(/[^0-9]/g, '');
      await sock.sendMessage(cleanJID + '@s.whatsapp.net', {
        image: { url: BOT_IMG },
        caption:
          `╔══════════════════════╗\n` +
          `║   CENTRAL-HEX-XDM    ║\n` +
          `╚══════════════════════╝\n\n` +
          `✅ *Bot connecté avec succès !*\n\n` +
          `👤 Créateur : ${CREATOR} 🇬🇳\n` +
          `📱 Contact  : ${CONTACT}\n` +
          `⚡ Version  : 2.0\n\n` +
          `_Tape_ *.help* _pour voir toutes les commandes_ 🚀`
      });

    } else if (connection === 'close') {
      const statusCode     = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`🔴 Connexion fermée. Code: ${statusCode}. Reconnexion: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => {
          activeSessions.delete(sessionId);
          createSession(phoneNumber, sessionId);
        }, 5000);
      } else {
        activeSessions.delete(sessionId);
      }
    }
  });

  // ════════════════════════════════════
  //   GESTION DES MESSAGES
  // ════════════════════════════════════
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from   = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body   = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || ''
    ).trim();
    const cmd  = body.toLowerCase();
    const args = body.slice(PREFIX.length).trim().split(/\s+/).slice(1);
    const text = args.join(' ');

    // Quiz en attente
    if (pendingQuiz.has(from)) {
      const expected = pendingQuiz.get(from);
      if (cmd.includes(expected)) {
        quizScores.set(sender, (quizScores.get(sender) || 0) + 1);
        pendingQuiz.delete(from);
        await sock.sendMessage(from, {
          text:
            `╭━━〔 ✅ BONNE RÉPONSE 〕━━┈⊷\n` +
            `┃✰│ 🎉 Félicitations !\n` +
            `┃✰│ Joueur : ${sender.split('@')[0]}\n` +
            `┃✰│ Score  : ${quizScores.get(sender)} point(s)\n` +
            `┃✰│ Tape *.quiz* pour continuer !\n` +
            `╰━━━━━━━━━━━━━━━┈⊷`
        });
        return;
      }
    }

    if (!body.startsWith(PREFIX)) return;

    if (cmd === `${PREFIX}help`) {
      await sock.sendMessage(from, { image: { url: BOT_IMG }, caption: buildHelpMenu() });
    }
    else if (cmd === `${PREFIX}ping`) {
      const msStart = Date.now();
      await sock.sendMessage(from, {
        text: `╭━━〔 🏓 PING 〕━━┈⊷\n┃✰│ Pong : ${Date.now() - msStart}ms\n┃✰│ Status : En ligne ✅\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}stats`) {
      const u = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(u/3600), m = Math.floor((u%3600)/60), s = u%60;
      await sock.sendMessage(from, {
        image: { url: BOT_IMG },
        caption:
          `╭━━〔 📊 STATISTIQUES 〕━━┈⊷\n` +
          `┃✰│ Bot      : ${BOT_NAME}\n` +
          `┃✰│ Sessions : ${activeSessions.size}\n` +
          `┃✰│ Uptime   : ${h}h ${m}m ${s}s\n` +
          `┃✰│ Version  : 2.0\n` +
          `╰━━━━━━━━━━━━━━━┈⊷\n\n👤 ${CREATOR} 🇬🇳`
      });
    }
    else if (cmd === `${PREFIX}info`) {
      await sock.sendMessage(from, {
        image: { url: BOT_IMG },
        caption:
          `╭━━〔 ℹ️ INFOS DU BOT 〕━━┈⊷\n` +
          `┃✰│ Nom      : ${BOT_NAME}\n` +
          `┃✰│ Version  : 2.0\n` +
          `┃✰│ Préfixe  : ${PREFIX}\n` +
          `┃✰│ Créateur : ${CREATOR} 🇬🇳\n` +
          `┃✰│ Contact  : ${CONTACT}\n` +
          `╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}time`) {
      const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Conakry' });
      await sock.sendMessage(from, {
        text: `╭━━〔 🕐 HEURE 〕━━┈⊷\n┃✰│ ${now}\n┃✰│ Fuseau : Guinée 🇬🇳\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd.startsWith(`${PREFIX}ia `) || cmd.startsWith(`${PREFIX}gpt `)) {
      await sock.sendMessage(from, {
        text: `╭━━〔 🤖 IA CENTRAL-HEX-XDM 〕━━┈⊷\n┃✰│ Question : ${text}\n┃✰│ Contact  : ${CONTACT}\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}quiz`) {
      const q = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
      pendingQuiz.set(from, q.r);
      setTimeout(() => pendingQuiz.delete(from), 30000);
      await sock.sendMessage(from, {
        text: `╭━━〔 🎮 QUIZ 〕━━┈⊷\n┃✰│ ${q.q}\n┃✰│ ⏱️ 30 secondes !\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}quizscore`) {
      const score = quizScores.get(sender) || 0;
      await sock.sendMessage(from, {
        text: `╭━━〔 🏆 SCORE QUIZ 〕━━┈⊷\n┃✰│ Joueur : ${sender.split('@')[0]}\n┃✰│ Score  : ${score} point(s)\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}pile` || cmd === `${PREFIX}jeu pile`) {
      const result = Math.random() > 0.5 ? '🟡 PILE' : '⚪ FACE';
      await sock.sendMessage(from, {
        text: `╭━━〔 🪙 PILE OU FACE 〕━━┈⊷\n┃✰│ Résultat : *${result}*\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}blague`) {
      const blagues = [
        'Pourquoi les plongeurs plongent-ils en arrière ? Sinon ils tomberaient dans le bateau ! 😂',
        'Qu\'est-ce qu\'un canif ? Un petit fien ! 😄',
        'Pourquoi l\'épouvantail a eu un prix ? Il était exceptionnel dans son domaine ! 🌾',
        'Un chat tombé dans un pot de peinture ? Un chat-peint ! 🎨',
      ];
      await sock.sendMessage(from, {
        text: `╭━━〔 😂 BLAGUE DU JOUR 〕━━┈⊷\n┃✰│ ${blagues[Math.floor(Math.random() * blagues.length)]}\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd.startsWith(`${PREFIX}8ball `)) {
      const reponses = [
        '✅ Oui, absolument !','✅ C\'est certain !','✅ Sans aucun doute !',
        '❓ Peut-être...','❓ C\'est flou, réessaie.','❓ Difficile à dire.',
        '❌ Non, définitivement.','❌ Mes sources disent non.','❌ Ne compte pas là-dessus.',
      ];
      await sock.sendMessage(from, {
        text: `╭━━〔 🎱 8BALL 〕━━┈⊷\n┃✰│ ❓ ${text}\n┃✰│ ${reponses[Math.floor(Math.random()*reponses.length)]}\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd.startsWith(`${PREFIX}love`)) {
      const pct = Math.floor(Math.random() * 101);
      const bar = '❤️'.repeat(Math.floor(pct/10)) + '🖤'.repeat(10-Math.floor(pct/10));
      const loveMsg = pct > 80 ? '🔥 C\'est l\'amour fou !' : pct > 50 ? '💛 Ça promet !' : '💔 Peut mieux faire...';
      await sock.sendMessage(from, {
        text: `╭━━〔 💕 LOVE METER 〕━━┈⊷\n┃✰│ ${bar}\n┃✰│ Score : *${pct}%*\n┃✰│ ${loveMsg}\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else if (cmd === `${PREFIX}tagall` || cmd.startsWith(`${PREFIX}hidetag`)) {
      try {
        const groupMeta = await sock.groupMetadata(from);
        const members   = groupMeta.participants.map(p => p.id);
        const isHide    = cmd.startsWith(`${PREFIX}hidetag`);
        await sock.sendMessage(from, {
          text: isHide
            ? (text || '📢 Message')
            : `╭━━〔 📢 TAGALL 〕━━┈⊷\n${text||''}\n\n${members.map(m=>`@${m.split('@')[0]}`).join(' ')}\n╰━━━━━━━━━━━━━━━┈⊷`,
          mentions: members
        });
      } catch {
        await sock.sendMessage(from, { text: `╭━━〔 ❌ ERREUR 〕━━┈⊷\n┃✰│ Commande réservée aux groupes.\n╰━━━━━━━━━━━━━━━┈⊷` });
      }
    }
    else if (cmd === `${PREFIX}open`) {
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await sock.sendMessage(from, { text: `╭━━〔 🔓 GROUPE OUVERT 〕━━┈⊷\n┃✰│ Tous les membres peuvent écrire.\n╰━━━━━━━━━━━━━━━┈⊷` });
      } catch {
        await sock.sendMessage(from, { text: `╭━━〔 ❌ ERREUR 〕━━┈⊷\n┃✰│ Tu dois être admin.\n╰━━━━━━━━━━━━━━━┈⊷` });
      }
    }
    else if (cmd === `${PREFIX}close`) {
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        await sock.sendMessage(from, { text: `╭━━〔 🔒 GROUPE FERMÉ 〕━━┈⊷\n┃✰│ Admins seulement.\n╰━━━━━━━━━━━━━━━┈⊷` });
      } catch {
        await sock.sendMessage(from, { text: `╭━━〔 ❌ ERREUR 〕━━┈⊷\n┃✰│ Tu dois être admin.\n╰━━━━━━━━━━━━━━━┈⊷` });
      }
    }
    else if (
      cmd.startsWith(`${PREFIX}yt `)     ||
      cmd.startsWith(`${PREFIX}tiktok `) ||
      cmd.startsWith(`${PREFIX}ig `)     ||
      cmd.startsWith(`${PREFIX}fb `)     ||
      cmd.startsWith(`${PREFIX}mp3 `)
    ) {
      await sock.sendMessage(from, {
        text: `╭━━〔 📥 TÉLÉCHARGEMENT 〕━━┈⊷\n┃✰│ 🔗 Lien reçu !\n┃✰│ ⚙️ Traitement en cours...\n┃✰│ Contact : ${CONTACT}\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
    else {
      await sock.sendMessage(from, {
        text: `╭━━〔 ❓ COMMANDE INCONNUE 〕━━┈⊷\n┃✰│ Tape *${PREFIX}help* pour voir\n┃✰│ toutes les commandes.\n╰━━━━━━━━━━━━━━━┈⊷`
      });
    }
  });

  return sock;
}

// ════════════════════════════════════════
//   ROUTES API
// ════════════════════════════════════════
app.post('/api/pair', async (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Numéro requis' });
  // Garder uniquement les chiffres
  phone = phone.replace(/[^0-9]/g, '');
  if (phone.length < 9) return res.status(400).json({ success: false, error: 'Numéro invalide' });
  const sessionId = 'session_' + phone + '_' + Date.now();
  res.json({ success: true, sessionId });
  createSession(phone, sessionId).catch(err =>
    sessionCache.set(sessionId, { status: 'error', error: err.message })
  );
});

app.get('/api/code/:sessionId', (req, res) => {
  const data = sessionCache.get(req.params.sessionId);
  if (!data) return res.json({ status: 'waiting', code: null });
  res.json(data);
});

app.get('/api/stats', (req, res) => {
  res.json({
    sessions: activeSessions.size,
    uptime:   Math.floor((Date.now() - startTime) / 1000),
    status:   'online'
  });
});

app.get('/',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/connect', (req, res) => res.sendFile(path.join(__dirname, 'public', 'connect.html')));

// ════════════════════════════════════════
//   DÉMARRAGE
// ════════════════════════════════════════
app.listen(PORT, () => {
  console.log(
    `\n╔══════════════════════════╗` +
    `\n║   ${BOT_NAME} v2.0   ║` +
    `\n╚══════════════════════════╝` +
    `\n🚀 Port     : ${PORT}` +
    `\n👤 Créateur : ${CREATOR} 🇬🇳` +
    `\n📱 Contact  : ${CONTACT}\n`
  );
});
