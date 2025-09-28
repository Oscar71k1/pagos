const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de Firebase Admin
let db;
try {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com"
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('✅ Firebase Admin inicializado correctamente');
} catch (error) {
  console.log('⚠️  Firebase no configurado. Usando modo de desarrollo con datos en memoria.');
  console.log('Error:', error.message);
  // Base de datos en memoria para desarrollo
  db = null;
}

// Forzar modo desarrollo para evitar problemas de índices de Firebase
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Modo desarrollo: Usando datos en memoria para evitar problemas de índices de Firebase');
  db = null;
}

// Datos en memoria para desarrollo
let pagosEnMemoria = [
  {
    id: '1',
    usuarioId: '1',
    concepto: 'Matrícula Semestre 2024-1',
    monto: 1500000,
    estado: 'Pendiente',
    fechaCreacion: '2024-01-15T10:30:00.000Z'
  },
  {
    id: '2',
    usuarioId: '1',
    concepto: 'Laboratorio de Química',
    monto: 250000,
    estado: 'Pagado',
    fechaCreacion: '2024-01-10T14:20:00.000Z'
  },
  {
    id: '3',
    usuarioId: '1',
    concepto: 'Certificado Académico',
    monto: 50000,
    estado: 'Pendiente',
    fechaCreacion: '2024-01-20T09:15:00.000Z'
  }
];

// Función para validar usuario con el microservicio de usuarios
async function validarUsuario(usuarioId) {
  try {
    // Usar URL de producción si está disponible, sino localhost para desarrollo
    const usuariosUrl = process.env.USUARIOS_URL || 'http://localhost:3001';
    const response = await axios.get(`${usuariosUrl}/api/validar/${usuarioId}`);
    return response.data;
  } catch (error) {
    console.error('Error al validar usuario:', error.message);
    return { existe: false, error: 'No se pudo validar el usuario' };
  }
}

// Función para generar ID único
function generarId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Rutas del microservicio de pagos

// Ruta de salud del microservicio (DEBE ir al principio)
app.get('/health', (req, res) => {
  res.json({
    mensaje: 'Microservicio de Pagos funcionando',
    timestamp: new Date().toISOString(),
    puerto: PORT
  });
});

// Ruta de prueba para verificar datos en memoria (DEBE ir al principio)
app.get('/test', (req, res) => {
  res.json({
    mensaje: 'Datos de prueba del microservicio de pagos',
    firebaseConfigurado: !!db,
    pagosEnMemoria: pagosEnMemoria,
    totalPagos: pagosEnMemoria.length
  });
});

// Crear nueva orden de pago
app.post('/crear', async (req, res) => {
  try {
    const { usuarioId, concepto, monto } = req.body;

    // Validaciones básicas
    if (!usuarioId || !concepto || !monto) {
      return res.status(400).json({ 
        error: 'UsuarioId, concepto y monto son requeridos' 
      });
    }

    if (monto <= 0) {
      return res.status(400).json({ 
        error: 'El monto debe ser mayor a 0' 
      });
    }

    // Validar que el usuario existe (comunicación con microservicio de usuarios)
    const validacionUsuario = await validarUsuario(usuarioId);
    if (!validacionUsuario.existe) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado',
        detalles: validacionUsuario.mensaje || 'El usuario no existe en el sistema'
      });
    }

    // Crear nueva orden de pago
    const nuevaOrden = {
      usuarioId,
      concepto,
      monto: parseFloat(monto),
      estado: 'Pendiente',
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    };

    let ordenId;
    if (db) {
      // Guardar en Firebase
      const docRef = await db.collection('pagos').add(nuevaOrden);
      ordenId = docRef.id;
    } else {
      // Guardar en memoria
      ordenId = generarId();
      nuevaOrden.id = ordenId;
      pagosEnMemoria.push(nuevaOrden);
    }

    res.status(201).json({
      mensaje: 'Orden de pago creada exitosamente',
      orden: {
        id: ordenId,
        ...nuevaOrden
      }
    });

  } catch (error) {
    console.error('Error al crear orden de pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener pagos de un usuario específico
app.get('/usuario/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    console.log(`🔍 Buscando pagos para usuario: ${usuarioId}`);

    // Validar que el usuario existe
    const validacionUsuario = await validarUsuario(usuarioId);
    console.log('✅ Validación de usuario:', validacionUsuario);
    
    if (!validacionUsuario.existe) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    let pagos;
    if (db) {
      // Obtener pagos de Firebase
      const pagosRef = db.collection('pagos');
      const querySnapshot = await pagosRef
        .where('usuarioId', '==', usuarioId)
        .orderBy('fechaCreacion', 'desc')
        .get();
      
      pagos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } else {
      // Obtener pagos de memoria
      console.log('📦 Usando datos en memoria. Total pagos:', pagosEnMemoria.length);
      pagos = pagosEnMemoria
        .filter(p => p.usuarioId === usuarioId)
        .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
      console.log('🔍 Pagos filtrados para usuario:', pagos.length);
    }

    console.log('📋 Pagos encontrados:', pagos.length);
    res.json({
      mensaje: 'Pagos obtenidos exitosamente',
      usuario: validacionUsuario.usuario,
      pagos,
      total: pagos.length
    });

  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Obtener pago específico por ID (DEBE ir después de las rutas específicas)
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let pago;
    if (db) {
      const doc = await db.collection('pagos').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }
      pago = { id: doc.id, ...doc.data() };
    } else {
      pago = pagosEnMemoria.find(p => p.id === id);
      if (!pago) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }
    }

    // Validar que el usuario existe
    const validacionUsuario = await validarUsuario(pago.usuarioId);
    if (!validacionUsuario.existe) {
      return res.status(404).json({ 
        error: 'Usuario asociado al pago no encontrado' 
      });
    }

    res.json({
      mensaje: 'Pago obtenido exitosamente',
      pago,
      usuario: validacionUsuario.usuario
    });

  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar estado de pago
app.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !['Pendiente', 'Pagado', 'Cancelado'].includes(estado)) {
      return res.status(400).json({ 
        error: 'Estado inválido. Debe ser: Pendiente, Pagado o Cancelado' 
      });
    }

    let pago;
    if (db) {
      const doc = await db.collection('pagos').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }
      
      await db.collection('pagos').doc(id).update({
        estado,
        fechaActualizacion: new Date().toISOString()
      });
      
      pago = { id: doc.id, ...doc.data(), estado };
    } else {
      pago = pagosEnMemoria.find(p => p.id === id);
      if (!pago) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }
      
      pago.estado = estado;
      pago.fechaActualizacion = new Date().toISOString();
    }

    res.json({
      mensaje: 'Estado de pago actualizado exitosamente',
      pago
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los pagos (para administradores)
app.get('/', async (req, res) => {
  try {
    let pagos;
    if (db) {
      const pagosRef = db.collection('pagos');
      const querySnapshot = await pagosRef
        .orderBy('fechaCreacion', 'desc')
        .get();
      
      pagos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } else {
      pagos = pagosEnMemoria
        .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
    }

    // Obtener información de usuarios para cada pago
    const pagosConUsuarios = await Promise.all(
      pagos.map(async (pago) => {
        const validacionUsuario = await validarUsuario(pago.usuarioId);
        return {
          ...pago,
          usuario: validacionUsuario.existe ? validacionUsuario.usuario : null
        };
      })
    );

    res.json({
      mensaje: 'Todos los pagos obtenidos exitosamente',
      pagos: pagosConUsuarios,
      total: pagos.length
    });

  } catch (error) {
    console.error('Error al obtener todos los pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Iniciar servidor solo si no estamos en Vercel
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`💳 Microservicio de Pagos ejecutándose en puerto ${PORT}`);
    console.log(`🔗 Endpoints disponibles:`);
    console.log(`   - POST /crear - Crear orden de pago`);
    console.log(`   - GET /usuario/:usuarioId - Pagos de usuario`);
    console.log(`   - GET /:id - Obtener pago específico`);
    console.log(`   - PUT /:id/estado - Actualizar estado`);
    console.log(`   - GET / - Todos los pagos`);
    console.log(`   - GET /health - Estado del servicio`);
    console.log(`   - GET /test - Datos de prueba`);
  });
}

// Exportar app para Vercel
module.exports = app;

