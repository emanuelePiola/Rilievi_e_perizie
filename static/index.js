'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const map = L.map('map').setView([44.417041, 7.430264], 13); // Coordinate iniziali

    // Aggiungi il layer di OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    let markers = []; // Array per gestire i marker sulla mappa

    // Funzione per caricare i rilievi e mostrarli sulla mappa
    async function loadRilievi(codOperatore = null) {
        try {
            const response = await fetch('/api/rilievi', { credentials: 'include' });
            if (!response.ok) throw new Error('Errore durante il recupero dei rilievi');
            const rilievi = await response.json();

            // Rimuovi i marker esistenti
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];

            // Filtra i rilievi per codOperatore, se specificato
            const filteredRilievi = codOperatore
                ? rilievi.filter(rilievo => rilievo.codOperatore === codOperatore)
                : rilievi;

            // Aggiungi i marker alla mappa
            filteredRilievi.forEach(rilievo => {
                const { coordinate, descrizione, foto, dettagli } = rilievo;
                if (coordinate && coordinate.lat && coordinate.long) {
                    const marker = L.marker([coordinate.lat, coordinate.long], {
                        icon: L.icon({
                            iconUrl: 'img/marker.png', // Icona personalizzata
                            iconSize: [69, 69],
                            iconAnchor: [34.5, 69], // Punta del marker
                            popupAnchor: [0, -30] // Popup sopra l'icona
                        })
                    })
                        .addTo(map)
                        .on('click', () => {
                            showDetails(rilievo); // Mostra i dettagli con SweetAlert
                        });
                    markers.push(marker);
                }
            });
        } catch (err) {
            console.error('Errore durante il caricamento dei rilievi:', err);
        }
    }

    // Funzione per mostrare i dettagli con SweetAlert
    function showDetails(rilievo) {
        const { foto, descrizione, coordinate, data_ora } = rilievo;

        // Trasforma la data in un formato leggibile
        const formattedDate = data_ora
            ? new Date(data_ora).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            })
            : 'Data non disponibile';

        // Verifica se 'foto' è un array valido
        let carouselHtml = '';
        if (Array.isArray(foto) && foto.length > 0) {
            // Crea il carousel per le foto
            carouselHtml = `
                <div id="carouselExample" class="carousel slide" data-bs-ride="carousel">
                    <div class="carousel-inner">
            `;
            foto.forEach((img, index) => {
                carouselHtml += `
                    <div class="carousel-item ${index === 0 ? 'active' : ''}">
                        <div class="img-container">
                            <img 
                                src="${img.url}" 
                                alt="${img.commento || 'Foto'}">
                            <div class="img-overlay">${img.commento || 'Nessun commento disponibile'}</div>
                        </div>
                    </div>
                `;
            });
            carouselHtml += `
                    </div>
                    <button class="carousel-control-prev" type="button" data-bs-target="#carouselExample" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#carouselExample" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Next</span>
                    </button>
                </div>
            `;
        } else {
            // Messaggio se non ci sono foto
            carouselHtml = '<p class="text-muted">Nessuna foto disponibile per questa perizia.</p>';
        }

        // Mostra la SweetAlert
        Swal.fire({
            title: '<h3 style="color: #2E7D32;">Dettagli Perizia</h3>',
            html: `
                <div style="background-color: #FDFBF7; padding: 20px; border-radius: 10px;">
                    ${carouselHtml}
                    <div class="mt-3" style="text-align: left;">
                        <h5 style="color: #2E7D32; font-weight: bold;">Descrizione</h5>
                        <p style="background-color: #E8F5E9; padding: 10px; border-radius: 5px;">${descrizione || 'Nessuna descrizione disponibile.'}</p>
                        <h5 style="color: #2E7D32; font-weight: bold;">Dettagli</h5>
                        <div style="background-color: #DFF5E1; padding: 10px; border-radius: 5px;">
                            <p style="font-size: 1rem; color: #2E7D32; margin: 0;">
                                <strong>Data:</strong>
                            </p>
                            <p style="font-size: 1rem; color: #6c757d; margin: 0 0 15px 15px;">
                                ${formattedDate}
                            </p>
                            <p style="font-size: 1rem; color: #2E7D32; margin: 0;">
                                <strong>Coordinate:</strong>
                            </p>
                            <p style="font-size: 1rem; color: #6c757d; margin: 0 0 5px 15px;">
                                Latitudine: ${coordinate?.lat || 'N/A'}
                            </p>
                            <p style="font-size: 1rem; color: #6c757d; margin: 0 0 5px 15px;">
                                Longitudine: ${coordinate?.long || 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            `,
            width: '80%',
            background: '#FDFBF7',
            showCloseButton: true,
            showConfirmButton: false,
        });
    }

    // Funzione per caricare gli utenti non admin
    async function loadNonAdminUsers() {
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            if (!response.ok) throw new Error('Errore durante il recupero degli utenti.');

            const users = await response.json();
            const nonAdminUsersSelect = document.getElementById('nonAdminUsers');

            // Svuota il menu a tendina
            nonAdminUsersSelect.innerHTML = '<option value="" selected>Tutti gli utenti</option>';

            // Filtra gli utenti non admin e aggiungili al menu a tendina
            users
                .filter(user => !user.admin)
                .forEach(user => {
                    const option = document.createElement('option');
                    option.value = user._id;
                    option.textContent = user.username;
                    nonAdminUsersSelect.appendChild(option);
                });
        } catch (err) {
            console.error('Errore durante il caricamento degli utenti non admin:', err);
            alert('Errore durante il caricamento degli utenti non admin.');
        }
    }

    // Event listener per il filtro degli utenti
    const nonAdminUsersSelect = document.getElementById('nonAdminUsers');
    nonAdminUsersSelect.addEventListener('change', () => {
        const selectedUserId = nonAdminUsersSelect.value;
        loadRilievi(selectedUserId || null); // Passa null se nessun utente è selezionato
    });

    // Carica gli utenti non admin e i rilievi iniziali
    await loadNonAdminUsers();
    await loadRilievi();

    // Gestione del logout
    const btnLogout = document.getElementById('btnLogout');
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
});