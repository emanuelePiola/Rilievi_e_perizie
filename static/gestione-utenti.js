document.addEventListener('DOMContentLoaded', async () => {
    const userManagementDiv = document.getElementById('userManagement');
    const createUserForm = document.getElementById('createUserForm');
    const dataNascitaInput = document.getElementById('dataNascita');
    const btnLogout = document.getElementById('btnLogout'); // Pulsante logout

    // Imposta la data massima per la data di nascita
    const today = new Date().toISOString().split('T')[0];
    dataNascitaInput.setAttribute('max', today);

    async function loadUsers() {
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            if (!response.ok) throw new Error('Errore durante il recupero degli utenti');
            const users = await response.json();

            let userTable = `
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Admin</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            users.forEach(user => {
                userTable += `
                    <tr>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.admin ? 'Sì' : 'No'}</td>
                        <td>
                            <button class="btn btn-success btn-sm" onclick="toggleAdmin('${user._id}', ${user.admin})">
                                ${user.admin ? 'Rimuovi Admin' : 'Rendi Admin'}
                            </button>
                        </td>
                    </tr>
                `;
            });

            userTable += '</tbody></table>';
            userManagementDiv.innerHTML = userTable;
        } catch (err) {
            console.error(err);
            alert('Errore durante il caricamento degli utenti.');
        }
    }

    window.toggleAdmin = async (userId, isAdmin) => {
        try {
            const response = await fetch(`/api/users/${userId}/toggleAdmin`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin: !isAdmin })
            });
            if (!response.ok) throw new Error('Errore durante l\'aggiornamento dei privilegi');
            await loadUsers();
        } catch (err) {
            console.error(err);
            alert('Errore durante l\'aggiornamento dei privilegi.');
        }
    };

    // Gestione del logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const httpResponse = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                if (httpResponse.ok) {
                    window.location.href = '/login.html'; // Reindirizza alla pagina di login
                } else {
                    alert('Errore durante il logout.');
                }
            } catch (err) {
                console.error('Errore durante il logout:', err);
            }
        });
    }

    // Gestione della creazione di un nuovo utente
    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const newUser = {
            nome: document.getElementById('nome').value,
            cognome: document.getElementById('cognome').value,
            email: document.getElementById('email').value,
            username: document.getElementById('username').value,
            data_nascita: document.getElementById('dataNascita').value,
            indirizzo: document.getElementById('indirizzo').value,
            citta: document.getElementById('citta').value,
            cap: document.getElementById('cap').value,
            admin: document.getElementById('admin').value === 'true'
        };

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.err || 'Errore durante la creazione del nuovo utente');
            }

            alert('Utente creato con successo!');
            createUserForm.reset();
        } catch (err) {
            console.error('Errore durante la creazione del nuovo utente:', err);
            alert(err.message || 'Errore durante la creazione del nuovo utente.');
        }
    });

    await loadUsers();
});