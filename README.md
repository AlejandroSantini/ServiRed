# ServiRed (SRV) – Código

Trabajo de Diploma UAI · Francisco Crema y Alejandro Santini.
Backend en **Node.js + Express** (JavaScript), base **PostgreSQL**, frontend **React** (pendiente), como fija la sección 12.2.7 del documento.

Estado: las **8 iteraciones** tienen backend (dominio, servicios, API y base de datos) y frontend en React, más el **módulo de seguridad**.

| Iteración | Requerimientos | Qué hay |
|---|---|---|
| I1 Perfiles y registro | RF01, RF02 | Alta de cliente y prestador, login, módulo de seguridad completo |
| I2 Búsqueda | RF03 | Filtros por categoría, zona y calificación mínima; perfil público |
| **I3 Contratación (núcleo)** | RF04, RF05, RF11 | Solicitud → presupuesto → orden → ejecución → cierre, con RN-C01 a RN-C13, notificaciones e historial de estados |
| I4 Agenda e historial | RF07, RF08 | Agenda del prestador, disponibilidad e historial con filtros |
| I5 Mensajería | RF06 | Conversaciones cliente ↔ prestador por solicitud |
| **I6 Valoraciones (núcleo)** | RF09, RF12 | Reseñas, reputación, denuncias y moderación, con RN-V01 a RN-V08 |
| I7 Monetización | RF10, RF13 | Comisiones configurables, balance y liquidación; indicadores e ingresos |
| I8 Destacados | RF14 | Planes Verificado y Premium, prioridad en la búsqueda, panel de visitas y conversión |

## Probar la aplicación completa (demo)

Dos terminales:

```bash
cd backend && npm install && npm run demo          # API en memoria con datos de ejemplo, puerto 3000
cd frontend && npm install && npm run dev          # http://localhost:5173
```

Si los puertos 3000 o 5173 están ocupados: `PUERTO=3100 npm run demo` y `API_URL=http://localhost:3100 npx vite --port 5190`.

Usuarios de ejemplo (contraseña `Demo2026x`): `cliente@demo.test`, `plomero@demo.test` (con plan Premium), `plomera@demo.test`, `electricista@demo.test` y `admin@demo.test`. Ya hay una solicitud con dos presupuestos para comparar.

## Frontend (`frontend/`)

React 19 + Vite + React Router. Las pantallas llaman a la API a través de `src/api/cliente.js`, sin reglas de negocio en el frontend: si la API rechaza algo, se muestra el mensaje y la regla (por ejemplo «Regla RN-C14»).

| Pantalla del documento | Ruta |
|---|---|
| 11.2 P1 Inicio / Login | `/ingresar` |
| 11.2 P2 Registro de prestador (3 pasos, RF01) | `/registro/prestador` |
| 11.2 P3 Registro de cliente | `/registro/cliente` |
| 11.2 P4 Búsqueda y filtrado (elegir hasta 3) | `/buscar` |
| 11.2 P5 Mensajería | panel de mensajes en `/solicitudes/:id` |
| 12.2.3 P1 Perfil del prestador | `/prestadores/:id` |
| 12.2.3 P2 Solicitud de presupuesto | `/solicitudes/nueva` |
| 12.2.3 P3 Gestión de solicitud (prestador) | `/solicitudes/:id` |
| 12.2.3 P4 Presupuestos recibidos (cliente) | `/solicitudes/:id` |
| 12.2.3 P5 y P6 Seguimiento y orden de servicio | `/ordenes/:id` |
| 12.3.3 P1 Historial | `/historial` |
| 12.3.3 P2 Modal de calificación | botón «Confirmar y calificar» en `/ordenes/:id` |
| 12.3.3 P3 Perfil público actualizado | `/prestadores/:id` |
| 12.3.3 P4 Denunciar reseña | `/resenas` |
| 12.3.3 P5 Moderación | `/admin/moderacion` |
| Otras | `/agenda`, `/notificaciones`, `/planes`, `/admin/reportes`, `/admin/usuarios`, `/admin/bitacora`, `/admin/integridad` |

El menú se arma con las patentes del usuario (RN-S06): cada usuario solo ve las pantallas que puede usar, y las rutas están protegidas igual. La ficha de solicitudes y órdenes muestra el recorrido del diagrama de estados con el estado actual marcado.

## Cómo correrlo con PostgreSQL

```bash
cd backend
npm install
npm test        # 57 pruebas: dominio, servicios, API y PostgreSQL real (PGlite, sin instalar nada)

# Opción A: sin base de datos (todo en memoria; se pierde al reiniciar)
PERSISTENCIA=memoria node src/server.js     # imprime el usuario administrador de prueba

# Opción B: con PostgreSQL
docker compose up -d                         # desde la carpeta ServiRed/
cp .env.example .env                         # completar claves y ADMIN_CONTRASENA
npm run db:inicializar                       # aplica db/01..05 y carga los datos iniciales
npm run dev
```

## Base de datos (`backend/db/`)

Un script por iteración, como en las secciones 12.2.7.1 y 12.3.7.1 del documento. Se aplican en orden y se pueden volver a ejecutar sin problemas.

| Script | Tablas |
|---|---|
| `01_seguridad_y_perfiles.sql` | usuario, cliente, prestador, administrador, zona, categoria_oficio, prestador_zona, prestador_categoria, permiso, permiso_hijo, usuario_permiso, sesion, bitacora, digito_verificador_vertical, estado_usuario, criticidad |
| `02_contratacion.sql` | solicitud_servicio, solicitud_destinatario, presupuesto, orden_servicio, notificacion, cambio_estado, turno, estado_solicitud, estado_presupuesto, estado_orden_servicio |
| `03_mensajeria.sql` | mensaje |
| `04_valoraciones.sql` | resena, denuncia, estado_resena, estado_denuncia, motivo_denuncia |
| `05_monetizacion.sql` | tasa_comision, comision, estado_comision, plan_visibilidad, suscripcion, visita_perfil, índices de la búsqueda |

Reglas que la base también controla, aunque alguien se saltee la aplicación (las pruebas de `test/postgres` lo verifican):

| Regla | Cómo la controla la base |
|---|---|
| RN-C01 | La FK `(id_solicitud, id_prestador)` de presupuesto apunta a `solicitud_destinatario`, y un trigger limita los destinatarios a 3 |
| RN-C02 | Índice único parcial: un solo presupuesto Emitido por prestador y solicitud |
| RN-C03 | CHECK de monto > 0, tiempo > 0 y validez posterior a la emisión |
| RN-C05 | Índice único parcial: un solo presupuesto Aceptado por solicitud; UK de orden por presupuesto |
| RN-C07 | CHECK `fecha_limite = fecha_creacion + 15 días` |
| RN-C09, RN-C10 | CHECK de fin ≥ inicio; una orden Interrumpida tiene que tener motivo |
| RN-V01 | UK `resena.id_orden` |
| RN-V02 | CHECK de puntaje entre 1 y 5; comentario de hasta 500 caracteres |
| RN-V04 | Trigger que impide editar una reseña (solo puede cambiar el estado) |
| RN-V05 | Índice único parcial: una sola denuncia Pendiente por reseña |
| RN-V08 | CHECK: una denuncia resuelta tiene administrador, fecha y comentario |
| RN-M01 | FK de la conversación a `solicitud_destinatario` |
| RN-K02 | UK de comisión por presupuesto |
| RN-S10 | La dirección del servicio y el teléfono se guardan cifrados |

## Arquitectura (sección 12.2.6 y RNF05)

```
src/
  dominio/          Entidades con su comportamiento. Cada transición de los diagramas de estados es un método que valida su regla.
    usuarios/       Usuario (abstracta) → Cliente, Prestador, Administrador
    seguridad/      Patente / Familia (Composite), Sesion, EntradaBitacora, PoliticaContrasena
    contratacion/   SolicitudServicio, Presupuesto, OrdenServicio, Notificacion + EstadoSolicitud, EstadoPresupuesto, EstadoOrdenServicio, Turno
    valoraciones/   Resena, Denuncia + EstadoResena, EstadoDenuncia, MotivoDenuncia
    mensajeria/     Mensaje
    monetizacion/   TasaComision, Comision, Suscripcion + EstadoComision, PlanVisibilidad
  aplicacion/       Un servicio por módulo (ContratacionService, ValoracionService, ...): cada método es un caso de uso
  persistencia/
    contratos/      Clases base de los repositorios, con la lógica de cada uno
    memoria/        Implementación para pruebas y desarrollo
    postgres/       Implementación para producción
  presentacion/     Rutas y controladores de Express; middlewares de sesión, permisos y errores
  transversal/      Criptografía: hash, cifrado, dígitos verificadores, tokens
```

- **Estados sin enums (devolución 4.5):** cada estado es una clase de catálogo con su tabla. La base común `EntidadConEstado` rechaza las transiciones no permitidas y guarda cada cambio. Después, `Notificador` lo registra con fecha en `cambio_estado` y avisa a la contraparte (RN-C13, RNF06).
- **Navegabilidad (12.2.5):** Presupuesto → Prestador y → Solicitud; Orden → Presupuesto; Reseña → Orden; Denuncia → Reseña, Prestador y Administrador. Ninguna entidad del lado «uno» guarda la lista inversa: se obtiene con consultas al repositorio.
- **Contratos con la lógica:** cada repositorio de las iteraciones 2 a 8 tiene su lógica en la clase base. `conFilasMemoria` y `conFilasPostgres` aportan solo el acceso a las filas, así las dos implementaciones se comportan igual. El flujo principal se prueba contra las dos.
- **Transacciones:** cada caso de uso se guarda completo o no se guarda nada (por ejemplo, aceptar un presupuesto toca 5 tablas).
- **Actor Sistema:** `PlanificadorService` corre cada minuto. Vence presupuestos (RN-C04) y solicitudes (RN-C07) y cierra las órdenes que pasaron 48 h sin confirmación (RN-C11). Las mismas reglas se aplican en el momento si alguien opera sobre algo vencido.

## Reglas nuevas para agregar al documento

El documento ya define RN-C01 a RN-C13 y RN-V01 a RN-V08. El código agrega estas reglas, que conviene sumar a los catálogos de reglas de cada iteración y a la hoja de seguimiento.

**Seguridad (Iteración 1)**

| Regla | Descripción |
|---|---|
| RN-S01 | Contraseña de 8 a 64 caracteres, con letras y números, que no contenga el correo |
| RN-S02 | Correo único, sin distinguir mayúsculas |
| RN-S03 | Tres intentos fallidos consecutivos bloquean la cuenta; solo un administrador la desbloquea |
| RN-S04 | Si el login falla, el mensaje es el mismo exista o no el correo |
| RN-S05 | La sesión vence a los 60 minutos; el cierre de sesión, el bloqueo, la baja o el cambio de contraseña la invalidan |
| RN-S06 | Cada operación exige una patente; las familias no pueden tener ciclos ni repetidos |
| RN-S07 | Siempre queda al menos un usuario activo con PERMISO_GESTIONAR; un administrador no puede bloquearse a sí mismo |
| RN-S08 | La bitácora de eventos de seguridad no se puede modificar ni borrar |
| RN-S09 | Usuario, permisos y bitácora tienen dígitos verificadores (DVH y DVV); si se detecta una alteración, solo entra el administrador |
| RN-S10 | El teléfono y la dirección se guardan cifrados con AES-256-GCM |
| RN-S11 | Backup y restauración solo con patente, y quedan en la bitácora |
| RN-S12 | Cambiar la contraseña exige la actual y cierra todas las sesiones |

**Otras iteraciones**

| Regla | Iteración | Descripción |
|---|---|---|
| RN-C14 | I3/I4 | El prestador no puede tener dos órdenes activas en la misma fecha y turno (mitiga el riesgo R08) |
| RN-M01 | I5 | Solo el cliente y los prestadores de la solicitud intercambian mensajes, en conversaciones separadas por prestador |
| RN-M02 | I5 | El mensaje es obligatorio y tiene hasta 1000 caracteres |
| RN-M03 | I5 | Una solicitud Vencida o Cancelada no admite mensajes nuevos |
| RN-K01 | I7 | Comisión = monto × porcentaje (de 0 a 100); el de la categoría tiene prioridad sobre el general, que empieza en 10 % |
| RN-K02 | I7 | Se registra una comisión al aceptar el presupuesto (el prestador la ve estimada desde que emite) |
| RN-K03 | I7 | El balance es la suma de las comisiones; la liquidación pasa las Pendientes a Liquidadas (el pago es externo) |
| RN-D01 | I8 | Si el prestador ya tiene un plan vigente, el nuevo empieza cuando termina el actual |
| RN-D02 | I8 | La búsqueda ordena por prioridad del plan vigente (Premium > Verificado > sin plan), luego por reputación y trabajos realizados |
| RN-D03 | I8 | El cobro del plan es externo; se registra el monto para el reporte de ingresos |
| RN-D04 | I8 | El panel de visitas y conversión requiere un plan vigente |

## API

Todas las rutas empiezan con `/api`. Las que dicen «sesión» piden `Authorization: Bearer <token>`. Los códigos HTTP son: **409** regla de negocio (la respuesta trae `regla`), **404** no existe o no es tuyo, **401** sin sesión, **403** sin patente.

| Iteración | Ruta | Patente |
|---|---|---|
| I1 | `POST /auth/login` · `POST /usuarios/clientes` · `POST /usuarios/prestadores` · `GET /catalogos/zonas` · `GET /catalogos/categorias` | pública |
| I1 | `POST /auth/logout` · `GET /auth/yo` · `PUT /auth/contrasena` · `GET /notificaciones` · `POST /notificaciones/:id/leer` | sesión |
| I2 | `GET /prestadores?idCategoria&idZona&calificacionMinima&pagina` · `GET /prestadores/:id` · `GET /prestadores/:id/resenas` | PRESTADOR_BUSCAR |
| I3 | `POST /solicitudes` | SOLICITUD_CREAR |
| I3 | `GET /solicitudes` · `GET /solicitudes/:id` | SOLICITUD_CREAR o PRESUPUESTO_EMITIR |
| I3 | `POST /solicitudes/:id/presupuestos` | PRESUPUESTO_EMITIR |
| I3 | `POST /presupuestos/:id/aceptar` (opcional `{fechaProgramada, idTurno}`) · `POST /presupuestos/:id/rechazar` | PRESUPUESTO_RESPONDER |
| I3 | `GET /ordenes` · `GET /ordenes/:id` | ORDEN_CONFIRMAR u ORDEN_EJECUTAR |
| I3 | `POST /ordenes/:id/iniciar` · `/interrumpir` `{motivo}` · `/reanudar` · `/finalizar` | ORDEN_EJECUTAR |
| I3 | `POST /ordenes/:id/confirmar` | ORDEN_CONFIRMAR |
| I3 | `POST /solicitudes/:id/cancelar` · `POST /ordenes/:id/cancelar` `{motivo}` | SOLICITUD_CANCELAR |
| I4 | `GET /agenda` · `PUT /agenda/disponibilidad` | AGENDA_GESTIONAR |
| I4 | `GET /historial?idEstado&desde&hasta` | HISTORIAL_VER |
| I5 | `GET /solicitudes/:id/mensajes?idPrestador` · `POST /solicitudes/:id/mensajes` `{idPrestador, texto}` | MENSAJE_ENVIAR |
| I6 | `POST /ordenes/:id/resena` `{puntaje, comentario}` | RESENA_REGISTRAR |
| I6 | `GET /resenas/recibidas` · `POST /resenas/:id/denuncias` `{idMotivo, detalle}` | RESENA_DENUNCIAR |
| I6 | `GET /denuncias` · `POST /denuncias/:id/resolver` `{decision: aprobar o desestimar, comentario}` | DENUNCIA_MODERAR |
| I7 | `GET`/`PUT /comisiones/tasas` · `GET /comisiones/prestadores/:id` · `POST /comisiones/prestadores/:id/liquidar` | COMISION_CONFIGURAR |
| I7 | `GET /comisiones/balance` | BALANCE_VER |
| I7 | `GET /reportes/indicadores?desde&hasta` · `GET /reportes/ingresos` | REPORTES_VER |
| I8 | `GET /planes` · `POST /suscripciones` `{idPlan}` · `GET /suscripciones` · `GET /suscripciones/panel` | PLAN_GESTIONAR |
| Seguridad | usuarios, permisos, bitácora, integridad y backups | ver `presentacion/rutas.js` |

## Próximos pasos

1. Pantalla de administración de familias y patentes en el frontend (hoy solo por API).
2. Probar contra un PostgreSQL real con `docker compose`. El esquema ya está probado con PGlite, que es PostgreSQL 16 embebido.
3. Sumar al documento las reglas nuevas y un apartado de implementación por iteración.
