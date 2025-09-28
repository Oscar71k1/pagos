# Despliegue en Render - Microservicio de Pagos

## Configuración para Render

Este microservicio está configurado para desplegarse en Render.com con las siguientes características:

### Variables de Entorno Requeridas

Configura las siguientes variables de entorno en el dashboard de Render:

```
NODE_ENV=production
PORT=10000
USUARIOS_URL=https://usuarios-vsao.onrender.com
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY_ID=tu-private-key-id
FIREBASE_PRIVATE_KEY=tu-private-key
FIREBASE_CLIENT_EMAIL=tu-client-email
FIREBASE_CLIENT_ID=tu-client-id
FIREBASE_CLIENT_X509_CERT_URL=tu-cert-url
```

### Endpoints Disponibles

- `GET /health` - Health check para Render
- `GET /test` - Datos de prueba del microservicio
- `POST /crear` - Crear nueva orden de pago
- `GET /usuario/:usuarioId` - Obtener pagos de un usuario
- `GET /:id` - Obtener pago específico por ID
- `PUT /:id/estado` - Actualizar estado de pago
- `GET /` - Obtener todos los pagos (admin)

### Configuración de Render

1. Conecta tu repositorio de GitHub
2. Selecciona el directorio `microservicios/pagos`
3. Usa las siguientes configuraciones:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### Comunicación entre Microservicios

- **Usuarios URL**: Configurada automáticamente para usar `https://usuarios-vsao.onrender.com`
- **Validación**: El microservicio de pagos valida usuarios con el microservicio de usuarios
- **Fallback**: Si no puede conectar con usuarios, funciona en modo independiente

### Notas Importantes

- El servidor se inicia automáticamente en el puerto asignado por Render
- Firebase se configura automáticamente si las variables de entorno están presentes
- Si Firebase no está configurado, el servicio funciona en modo memoria para desarrollo
- El health check está disponible en `/health` para monitoreo de Render
- La comunicación con el microservicio de usuarios es automática usando la URL configurada
