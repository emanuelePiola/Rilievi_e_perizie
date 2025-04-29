import http from 'http';
import https from 'https';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { v2 as cloudinary } from 'cloudinary';

// Configura Cloudinary
cloudinary.config({
  cloud_name: 'dv9rtnow9', // Dal file .env
  api_key: '652236681154422', // Dal file .env
  api_secret: '0WlofFHPcT-6zKlwar28S7-gYU0' // Dal file .env
});

dotenv.config({ path: '.env' });

const app = express();
const connectionString = process.env.connectionStringAtlas || '';
const DB_NAME = process.env.dbName || '';
const PORT :any = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const tokenExpiresIn = 3600; // 1 ora
const privateKey = fs.readFileSync('./keys/privateKey.pem', 'utf8');
const publicKey = fs.readFileSync('./keys/publicKey.crt', 'utf8');
const jwtKey = fs.readFileSync('./keys/jwtKey', 'utf8');

const cookiesOptions = {
  path: '/',
  maxAge: tokenExpiresIn * 1000,
  httpOnly: true,
  secure: true,
  sameSite: false
};

// Server HTTP PER RENDER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// Configura il server HTTPS
// const credentials = { key: privateKey, cert: publicKey };
// const httpsServer = https.createServer(credentials, app);
// httpsServer.listen(HTTPS_PORT, () => {
//   console.log(`HTTPS server listening on port ${HTTPS_PORT}`);
// });

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
const whitelist = [
  'http://localhost:3000',
  'https://localhost:3001',
  'http://localhost:8100',
  'https://rilievi-e-perizie-emanuelepiola.onrender.com',
  'http://localhost:4200', // server angular
  'https://cordovaapp' // porta 443 (default)
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin)
      // browser direct call
      return callback(null, true);
    if (whitelist.indexOf(origin) === -1) {
      var msg = `The CORS policy for this site does not
    allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    } else return callback(null, true);
  },
  credentials: true
};
app.use('/', cors(corsOptions));
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }));
app.use('/', express.static('./static'));

// Funzione per creare un token JWT
function createToken(data: any) {
  const now = Math.floor(Date.now() / 1000); // Tempo corrente in secondi
  const payload = {
    iat: now,
    exp: now + tokenExpiresIn,
    _id: data._id,
    username: data.username,
    admin: data.admin || false
  };
  return jwt.sign(payload, jwtKey);
}

// Middleware per verificare il token JWT
function verifyToken(req: any, res: any, next: any) {
  const token = req.cookies.token;
  if (!token) {
    console.error("Token mancante.");
    return res.status(401).send({ err: "Token mancante. Effettua nuovamente il login." });
  }

  jwt.verify(token, jwtKey, (err, payload: any) => {
    if (err) {
      console.error("Errore nella verifica del token:", err.message);
      if (err.name === "TokenExpiredError") {
        console.error("Token scaduto.");
        return res.status(401).send({ err: "Token scaduto. Effettua nuovamente il login." });
      }
      return res.status(401).send({ err: "Token non valido. Effettua nuovamente il login." });
    }

    req["payload"] = payload;
    next();
  });
}

// Endpoint di login
app.post('/api/login', async (req: any, res: any) => {
  const { username, password } = req.body;

  if (!username || !password) {
    console.error('Username o password mancanti.');
    return res.status(400).send({ err: 'Username e password sono obbligatori.' });
  }

  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('users');

    const user = await collection.findOne({ username: new RegExp(`^${username}$`, 'i') });
    if (!user) {
      console.error('Utente non trovato.');
      return res.status(401).send({ err: 'Username o password non validi.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.error('Password non valida.');
      return res.status(401).send({ err: 'Username o password non validi.' });
    }

    const token = createToken(user);
    console.log('Token generato:', token);
    console.log('Utente autenticato:', { username: user.username, admin: user.admin });

    res.cookie('token', token, cookiesOptions);
    res.send({ ris: 'ok', username: user.username, admin: user.admin });
  } catch (err) {
    console.error('Errore durante il login:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Endpoint di logout
app.post('/api/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.send({ ris: 'Logout effettuato con successo.' });
});

// Endpoint per creare un nuovo rilievo
app.post('/api/rilievi', verifyToken, async (req: any, res: any) => {
  const { cordinate, codOperatore, data_ora, descrizione_generale, foto } = req.body;

  if (!cordinate || !codOperatore || !data_ora || !descrizione_generale || !foto) {
    return res.status(400).send({ err: 'Tutti i campi sono obbligatori.' });
  }

  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('rilievi_e_perizie');

    const rilievo = {
      cordinate,
      codOperatore,
      data_ora,
      descrizione_generale,
      foto,
    };

    const result = await collection.insertOne(rilievo);
    res.send({ message: 'Rilievo creato con successo.', rilievoId: result.insertedId });
  } catch (err) {
    console.error('Errore durante la creazione del rilievo:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Endpoint protetto per ottenere i rilievi
app.get('/api/rilievi', verifyToken, async (req: Request, res: Response) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('rilievi_e_perizie');

    const rilievi = await collection.find().toArray();
    console.log('Rilievi recuperati:', rilievi); // Log per debug
    res.send(rilievi);
  } catch (err) {
    console.error('Errore durante il recupero dei rilievi:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Endpoint protetto per ottenere i dati dell'utente
app.get('/api/user', verifyToken, (req: any, res: any) => {
  const user = req.payload; // Dati decodificati dal token JWT
  res.send({ username: user.username, admin: user.admin });
});

// Endpoint per il login con Google
const googleClient = new OAuth2Client('589458079505-h51hr4mk0d0t6o2hvesn07ur3f46b1ol.apps.googleusercontent.com');

app.post('/api/googleLogin', async (req: any, res: any) => {
  const { googleToken } = req.body;

  if (!googleToken) {
    return res.status(400).send({ err: 'Token di Google mancante.' });
  }

  try {
    // Verifica il token di Google
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: '589458079505-h51hr4mk0d0t6o2hvesn07ur3f46b1ol.apps.googleusercontent.com'
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).send({ err: 'Token di Google non valido.' });
    }

    const email = payload.email;
    const username = payload.name || email.split('@')[0]; // Usa il nome o parte dell'email come username

    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('users');

    // Controlla se l'utente esiste
    let user = await collection.findOne({ email: email });
    if (!user) {
      // Crea un nuovo utente se non esiste
      const newUser = {
        email: email,
        username: username,
        admin: false, // Imposta admin a false di default
        password: null // Nessuna password per gli utenti Google
      };
      const result = await collection.insertOne(newUser);
      
      // Recupera il nuovo utente creato utilizzando l'ID restituito
      user = { ...newUser, _id: result.insertedId };
    }

    // Genera un token JWT
    const token = createToken(user);
    res.cookie('token', token, cookiesOptions);
    res.send({ username: user.username, admin: user.admin });
  } catch (err) {
    console.error('Errore durante la verifica del token di Google:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Endpoint per ottenere la lista degli utenti
app.get('/api/users', verifyToken, async (req: Request, res: Response) => {
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('users');
    const users = await collection.find().toArray();
    res.send(users);
  } catch (err) {
    console.error('Errore durante il recupero degli utenti:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

app.patch('/api/users/:id/toggleAdmin', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.params.id;
    const { admin } = req.body;

    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('users');

    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { admin: admin } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ err: 'Utente non trovato.' });
    }

    res.send({ ris: 'Privilegi aggiornati con successo.' });
  } catch (err) {
    console.error('Errore durante l\'aggiornamento dei privilegi:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

app.post('/api/users', verifyToken, async (req: any, res: any) => {
  try {
    const { nome, cognome, email, username, data_nascita, indirizzo, citta, cap, admin } = req.body;

    // Verifica che tutti i campi obbligatori siano presenti
    if (!nome || !cognome || !email || !username || !data_nascita || !indirizzo || !citta || !cap) {
      return res.status(400).send({ err: 'Tutti i campi sono obbligatori.' });
    }

    // Genera una password bcryptata di default
    const hashedPassword = await bcrypt.hash('password', 10);

    // Crea il nuovo utente
    const newUser = {
      nome,
      cognome,
      email,
      username,
      password: hashedPassword, // Password hashata
      data_nascita,
      indirizzo,
      citta,
      cap,
      admin: admin || false
    };

    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('users');
    await collection.insertOne(newUser);

    res.send({ ris: 'Utente creato con successo.' });
  } catch (err) {
    console.error('Errore durante la creazione del nuovo utente:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Endpoint per caricare foto
app.post('/api/rilievi/:id/foto', verifyToken, async (req: any, res: any) => {
  try {
    const periziaId = req.params.id;
    const { commento } = req.body;
    const file = req.files?.file;

    if (!file) {
      return res.status(400).send({ err: 'File mancante.' });
    }

    // Carica la foto su Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'rilievi_perizie',
    });
    console.log('Foto caricata su Cloudinary:', result); // Log per debug

    // Aggiorna il database con l'URL della foto e il commento
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DB_NAME).collection('rilievi_e_perizie');

    const updateResult = await collection.updateOne(
      { _id: new ObjectId(periziaId) },
      {
        $push: {
          foto: {
            url: result.secure_url,
            commento: commento || '',
          },
        }as any,
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).send({ err: 'Perizia non trovata.' });
    }

    res.send({ ris: 'Foto caricata con successo.', url: result.secure_url });
  } catch (err) {
    console.error('Errore durante il caricamento della foto:', err);
    res.status(500).send({ err: 'Errore interno del server.' });
  }
});

// Default route & error handler
app.use((req: Request, res: Response) => {
  res.status(404).send('Risorsa non trovata.');
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Errore interno del server.');
});
