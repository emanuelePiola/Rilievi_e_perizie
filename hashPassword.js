const bcrypt = require('bcrypt');

const password = 'Vecio081'; // Sostituisci con la password che vuoi hashare

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Errore durante la generazione dell\'hash:', err);
  } else {
    console.log('Password hashata:', hash);
  }
});