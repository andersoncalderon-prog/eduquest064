# Firestore Security Recommendations

## Estado actual
Tu app ya dejó de usar la regla abierta de prueba. Ahora usa una regla segura para requerir autenticación en Firestore.

## Regla recomendada

Reemplaza tus reglas de Firestore con esto:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/{document=**} {
      allow read, write: if request.auth != null;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Por qué esta regla
- `request.auth != null` exige que el cliente esté autenticado.
- La app ya usa Firebase Auth (`signInAnonymously` o `signInWithCustomToken`).
- Esto evita accesos arbitrarios desde scripts externos.

## Mejora recomendada para producción
Si quieres separar `battles` y `players`, usa:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/battles/{battleId} {
      allow read, write: if request.auth != null;
    }

    match /artifacts/{appId}/public/data/players/{playerId} {
      allow read, write: if request.auth != null;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Uso de variables de entorno en Vite
Agrega un archivo `.env.local` en tu proyecto con:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Luego reinicia el servidor de desarrollo:

```bash
npm run dev
```

## Notas
- No subas `.env.local` a Git.
- Si usas `devMode` (`?dev=1`), Firebase no se inicializa y tu app usa la simulación local.
- Si tus alumnos usan la app publicada, no debería afectarles si tu auth funciona correctamente.
