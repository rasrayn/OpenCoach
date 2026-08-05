# Documento de Requerimientos

## Introducción

Este documento describe los requerimientos del sistema de autenticación y login de usuarios para una aplicación multiplataforma. El sistema gestiona el acceso de tres tipos de usuarios con una jerarquía de roles definida: Administradores, Entrenadores y Atletas.

Existe un registro público exclusivamente para el rol de Entrenador: cualquier persona puede registrarse como Entrenador, indicando opcionalmente datos de perfil como el gimnasio o programa de entrenamiento al que pertenece. Una vez autenticado exitosamente, el Entrenador accede a su dashboard personal. Desde allí puede añadir Atletas, asignándoles email y contraseña. El Administrador puede crear tanto Entrenadores como otros Administradores, siendo el único rol con capacidad de crear Administradores. Los Atletas no pueden registrarse por su cuenta; acceden con las credenciales que les asigna su Entrenador, y se les recomienda cambiar su contraseña en el primer acceso. El dashboard de cada rol es una funcionalidad separada y no se detalla en este documento.

---

## Glosario

- **Sistema**: El sistema de autenticación y login de usuarios de la aplicación.
- **Usuario**: Persona con una cuenta activa que puede autenticarse y usar la aplicación.
- **Rol**: Conjunto de permisos y privilegios asignados a un Usuario que determina sus capacidades dentro de la aplicación.
- **Administrador**: Usuario con el nivel de acceso más alto. Puede crear y gestionar cuentas de Entrenadores y de otros Administradores. Es el único rol con capacidad de crear nuevas cuentas de Administrador.
- **Entrenador**: Usuario que puede registrarse públicamente en la plataforma o ser creado por un Administrador. Puede crear y gestionar cuentas de Atletas, asignándoles sus credenciales de acceso. Durante el registro puede especificar datos de perfil como el gimnasio o programa de entrenamiento al que pertenece.
- **Atleta**: Usuario de nivel base cuyas credenciales (email y contraseña) son asignadas por su Entrenador. No puede registrarse por su cuenta ni elegir sus propias credenciales iniciales, pero puede cambiar su contraseña una vez autenticado.
- **Primer_Acceso**: Condición que se cumple cuando un Atleta se autentica por primera vez con las credenciales asignadas por su Entrenador.
- **Perfil_de_Entrenador**: Conjunto de datos opcionales que el Entrenador puede aportar durante el registro, como el nombre del gimnasio o el programa de entrenamiento al que pertenece.
- **Registro_Público**: Proceso mediante el cual cualquier persona puede crear una cuenta de Entrenador sin necesidad de intervención de un Administrador.
- **Credenciales**: Combinación de email y contraseña que usa el Usuario para autenticarse.
- **Token_de_Acceso**: Token JWT de corta duración emitido tras una autenticación exitosa que autoriza el acceso a recursos protegidos.
- **Token_de_Refresco**: Token de larga duración que permite obtener un nuevo Token_de_Acceso sin re-autenticarse. Su duración varía según el Rol del Usuario.
- **Sesión**: Estado activo de autenticación de un Usuario en la aplicación.
- **Autenticador**: Componente del Sistema responsable de verificar identidades y emitir tokens.
- **Gestor_de_Roles**: Componente del Sistema responsable de asignar, validar y gestionar los roles de los Usuarios.
- **Gestor_de_Usuarios**: Componente del Sistema responsable de crear, activar y administrar cuentas de Usuario.
- **Dispositivo**: Plataforma física o virtual desde la que el Usuario accede a la aplicación (web, iOS, Android, desktop).

---

## Requerimientos

### Requerimiento 1: Creación de Cuentas por Administradores

**User Story:** Como Administrador, quiero poder crear nuevas cuentas de Administrador y de Entrenador, para gestionar el acceso de los usuarios a la plataforma según la jerarquía de roles.

#### Criterios de Aceptación

1. WHILE un Usuario tiene el Rol de Administrador, THE Gestor_de_Usuarios SHALL permitirle crear nuevas cuentas con Rol de Administrador.
2. WHILE un Usuario tiene el Rol de Administrador, THE Gestor_de_Usuarios SHALL permitirle crear nuevas cuentas con Rol de Entrenador.
3. WHEN un Administrador crea una nueva cuenta, THE Gestor_de_Usuarios SHALL requerir un email único y una contraseña inicial que cumpla los criterios de seguridad definidos en el Requerimiento 4.
4. WHEN un Administrador crea una nueva cuenta con un email ya registrado en el Sistema, THE Gestor_de_Usuarios SHALL retornar un mensaje de error indicando que el email ya está en uso.
5. WHEN un Administrador crea una nueva cuenta exitosamente, THE Sistema SHALL enviar al email del nuevo Usuario sus credenciales de acceso dentro de los 60 segundos siguientes.
6. WHEN un Administrador crea una nueva cuenta exitosamente, THE Gestor_de_Usuarios SHALL asignar el Rol indicado por el Administrador y activar la cuenta de forma inmediata.
7. IF un Usuario sin Rol de Administrador intenta crear una cuenta con Rol de Administrador, THEN THE Sistema SHALL rechazar la operación y retornar un error de autorización con código HTTP 403.

---

### Requerimiento 2: Registro Público de Entrenadores

**User Story:** Como persona interesada en la plataforma, quiero poder registrarme como Entrenador de forma pública, para crear mi cuenta sin necesitar la intervención de un Administrador y comenzar a gestionar mis Atletas.

#### Criterios de Aceptación

1. THE Sistema SHALL permitir a cualquier persona iniciar el proceso de Registro_Público para crear una cuenta con Rol de Entrenador.
2. WHEN una persona completa el Registro_Público, THE Gestor_de_Usuarios SHALL requerir un email único y una contraseña que cumpla los criterios de seguridad definidos en el Requerimiento 4.
3. WHEN una persona completa el Registro_Público, THE Gestor_de_Usuarios SHALL permitir especificar de forma opcional los datos del Perfil_de_Entrenador, incluyendo nombre del gimnasio y programa de entrenamiento al que pertenece.
4. WHEN una persona se registra con un email ya registrado en el Sistema, THE Gestor_de_Usuarios SHALL retornar un mensaje de error indicando que el email ya está en uso.
5. WHEN el Registro_Público se completa exitosamente, THE Gestor_de_Usuarios SHALL asignar el Rol de Entrenador y crear la cuenta de forma inmediata.
6. WHEN el Registro_Público se completa exitosamente, THE Sistema SHALL iniciar el proceso de verificación de email descrito en el Requerimiento 5.
7. IF una persona intenta registrarse públicamente con un Rol distinto al de Entrenador, THEN THE Sistema SHALL rechazar la operación y retornar un error indicando que el Registro_Público está restringido al Rol de Entrenador.

---

### Requerimiento 3: Creación de Cuentas de Atletas por Entrenadores

**User Story:** Como Entrenador, quiero poder crear cuentas para mis Atletas asignándoles sus credenciales, para que puedan acceder a la plataforma con las credenciales que yo les indique.

#### Criterios de Aceptación

1. WHILE un Usuario tiene el Rol de Entrenador, THE Gestor_de_Usuarios SHALL permitirle crear nuevas cuentas con Rol de Atleta.
2. WHEN un Entrenador crea una cuenta de Atleta, THE Gestor_de_Usuarios SHALL requerir un email único y una contraseña asignada por el Entrenador que cumpla los criterios de seguridad definidos en el Requerimiento 4.
3. WHEN un Entrenador intenta crear una cuenta de Atleta con un email ya registrado en el Sistema, THE Gestor_de_Usuarios SHALL retornar un mensaje de error indicando que el email ya está en uso.
4. WHEN un Entrenador crea una cuenta de Atleta exitosamente, THE Gestor_de_Usuarios SHALL asignar el Rol de Atleta, activar la cuenta de forma inmediata y marcar la cuenta con el indicador de Primer_Acceso.
5. WHEN un Entrenador crea una cuenta de Atleta exitosamente, THE Sistema SHALL enviar al email del Atleta sus credenciales de acceso dentro de los 60 segundos siguientes.
6. WHEN un Entrenador crea una cuenta de Atleta exitosamente, THE Sistema SHALL iniciar el proceso de verificación de email descrito en el Requerimiento 5.
7. IF un Entrenador intenta crear una cuenta con un Rol distinto al de Atleta, THEN THE Sistema SHALL rechazar la operación y retornar un error de autorización con código HTTP 403.

---

### Requerimiento 4: Autenticación con Credenciales

**User Story:** Como Usuario registrado, quiero iniciar sesión con mi email y contraseña, para acceder a la aplicación de forma segura desde cualquier Dispositivo.

#### Criterios de Aceptación

1. WHEN un Usuario con Rol de Atleta envía credenciales válidas, THE Autenticador SHALL emitir un Token_de_Acceso con duración de 15 minutos y un Token_de_Refresco sin fecha de expiración.
2. WHEN un Usuario con Rol de Entrenador envía credenciales válidas, THE Autenticador SHALL emitir un Token_de_Acceso con duración de 15 minutos y un Token_de_Refresco con duración de 7 días.
3. WHEN un Usuario con Rol de Administrador envía credenciales válidas, THE Autenticador SHALL emitir un Token_de_Acceso con duración de 15 minutos y un Token_de_Refresco con duración de 1 día.
4. WHEN un Usuario envía credenciales incorrectas, THE Autenticador SHALL retornar un mensaje de error genérico que no revele cuál campo es incorrecto.
5. IF un Usuario realiza 5 intentos de autenticación fallidos consecutivos en un período de 10 minutos, THEN THE Autenticador SHALL bloquear temporalmente el acceso a esa cuenta durante 15 minutos.
6. WHILE la cuenta de un Usuario está bloqueada temporalmente, THE Autenticador SHALL rechazar nuevos intentos de autenticación e indicar el tiempo restante de bloqueo.
7. WHEN un Usuario se autentica exitosamente, THE Autenticador SHALL registrar la fecha, hora y Dispositivo del acceso.
8. THE Sistema SHALL verificar que toda contraseña asignada tenga al menos 8 caracteres, incluya al menos una letra mayúscula, una letra minúscula, un dígito numérico y un carácter especial.
9. IF una contraseña no cumple los criterios de seguridad, THEN THE Sistema SHALL retornar un mensaje de error describiendo los requisitos incumplidos.
10. WHEN un Usuario con Rol de Entrenador o Atleta se autentica exitosamente, THE Sistema SHALL redirigir al Usuario a su dashboard personal.

---

### Requerimiento 5: Verificación de Email

**User Story:** Como Usuario con una cuenta recién creada, quiero verificar mi dirección de email, para confirmar que tengo acceso a esa cuenta y activar mi perfil completamente.

#### Criterios de Aceptación

1. THE Sistema SHALL requerir la verificación de email para todos los roles: Administrador, Entrenador y Atleta, independientemente de cómo haya sido creada la cuenta.
2. WHEN un Administrador crea una cuenta de Administrador o Entrenador, THE Sistema SHALL enviar al email del nuevo Usuario un enlace de verificación dentro de los 60 segundos siguientes.
3. WHEN un Entrenador crea una cuenta de Atleta, THE Sistema SHALL enviar al email del Atleta un enlace de verificación dentro de los 60 segundos siguientes.
4. WHEN un Usuario hace clic en el enlace de verificación enviado a su email, THE Sistema SHALL marcar el email del Usuario como verificado.
5. WHEN un enlace de verificación es utilizado más de una vez, THE Sistema SHALL retornar un mensaje indicando que el enlace ya fue usado.
6. WHILE el email de un Usuario no está verificado, THE Sistema SHALL restringir el acceso a funcionalidades que requieran email verificado.
7. IF un enlace de verificación ha superado las 24 horas desde su emisión, THEN THE Sistema SHALL rechazar la verificación e indicar que el enlace expiró.
8. WHEN un Usuario solicita el reenvío del email de verificación, THE Sistema SHALL emitir un nuevo enlace e invalidar el anterior.

---

### Requerimiento 6: Cambio de Contraseña del Atleta en el Primer Acceso

**User Story:** Como Atleta que accede por primera vez, quiero ser informado de que puedo cambiar mi contraseña, para reemplazar las credenciales asignadas por mi Entrenador por unas que yo mismo haya elegido.

#### Criterios de Aceptación

1. WHILE un Atleta tiene activo el indicador de Primer_Acceso, THE Sistema SHALL mostrar una notificación recomendando al Atleta cambiar su contraseña.
2. WHEN un Atleta cambia su contraseña, THE Sistema SHALL verificar que la nueva contraseña cumpla los criterios de seguridad definidos en el Requerimiento 4.
3. WHEN un Atleta establece una nueva contraseña exitosamente, THE Sistema SHALL eliminar el indicador de Primer_Acceso de su cuenta.
4. WHEN un Atleta establece una nueva contraseña exitosamente, THE Sistema SHALL invalidar todos los Tokens_de_Refresco activos del Atleta y requerir nueva autenticación.
5. THE Sistema SHALL permitir al Atleta continuar usando la plataforma sin cambiar su contraseña, manteniendo visible la notificación hasta que realice el cambio.

---

### Requerimiento 7: Cambio de Contraseña de Usuarios Autenticados

**User Story:** Como Usuario autenticado, quiero poder cambiar mi contraseña en cualquier momento, para mantener la seguridad de mi cuenta.

#### Criterios de Aceptación

1. WHILE un Usuario está autenticado, THE Sistema SHALL permitirle cambiar su contraseña proporcionando su contraseña actual y una contraseña nueva.
2. WHEN un Usuario solicita un cambio de contraseña, THE Autenticador SHALL verificar que la contraseña actual proporcionada sea correcta antes de aplicar el cambio.
3. IF la contraseña actual proporcionada no es correcta, THEN THE Sistema SHALL rechazar el cambio y retornar un mensaje de error genérico.
4. WHEN un Usuario establece una nueva contraseña exitosamente, THE Sistema SHALL verificar que cumpla los criterios de seguridad definidos en el Requerimiento 4.
5. WHEN un Usuario cambia su contraseña exitosamente, THE Sistema SHALL invalidar todos los Tokens_de_Refresco activos del Usuario en todos sus Dispositivos.
6. THE Sistema SHALL registrar el evento de cambio de contraseña en el log de auditoría descrito en el Requerimiento 11.

---

### Requerimiento 8: Gestión de Tokens y Sesiones

**User Story:** Como Usuario autenticado, quiero que mi sesión se mantenga activa de forma segura sin tener que re-autenticarme frecuentemente, para tener una experiencia fluida en la aplicación.

#### Criterios de Aceptación

1. WHEN un Token_de_Acceso expira y el Usuario presenta un Token_de_Refresco válido, THE Autenticador SHALL emitir un nuevo Token_de_Acceso sin requerir re-autenticación.
2. IF el Token_de_Refresco de un Administrador ha superado 1 día desde su emisión o ha sido revocado, THEN THE Autenticador SHALL rechazar la solicitud de refresco y requerir re-autenticación completa.
3. IF el Token_de_Refresco de un Entrenador ha superado 7 días desde su emisión o ha sido revocado, THEN THE Autenticador SHALL rechazar la solicitud de refresco y requerir re-autenticación completa.
4. IF el Token_de_Refresco de un Atleta ha sido revocado, THEN THE Autenticador SHALL rechazar la solicitud de refresco y requerir re-autenticación completa.
5. WHEN un Usuario cierra sesión, THE Sistema SHALL revocar el Token_de_Refresco activo de ese Dispositivo.
6. THE Sistema SHALL soportar sesiones simultáneas desde múltiples Dispositivos para el mismo Usuario.
7. WHEN un Usuario revoca todas sus sesiones activas, THE Sistema SHALL invalidar todos los Tokens_de_Refresco asociados a ese Usuario en todos sus Dispositivos.

---

### Requerimiento 9: Gestión de Roles y Permisos

**User Story:** Como Administrador, quiero gestionar los roles de los usuarios, para controlar qué funcionalidades puede acceder cada tipo de Usuario en la aplicación según la jerarquía definida.

#### Criterios de Aceptación

1. THE Sistema SHALL soportar exactamente los roles predefinidos: Administrador, Entrenador y Atleta.
2. WHEN un Administrador asigna un Rol a un Usuario, THE Gestor_de_Roles SHALL reflejar el cambio en la siguiente solicitud autenticada del Usuario sin requerir re-login.
3. WHILE un Usuario tiene el Rol de Administrador, THE Gestor_de_Roles SHALL permitirle modificar el Rol de cualquier Usuario.
4. IF un Entrenador intenta modificar el Rol de cualquier Usuario, THEN THE Sistema SHALL rechazar la operación y retornar un error de autorización con código HTTP 403.
5. IF un Atleta intenta modificar el Rol de cualquier Usuario, THEN THE Sistema SHALL rechazar la operación y retornar un error de autorización con código HTTP 403.
6. IF un Usuario intenta acceder a un recurso para el que su Rol no tiene permisos, THEN THE Sistema SHALL retornar un error de autorización con código HTTP 403.

---

### Requerimiento 10: Recuperación de Contraseña

**User Story:** Como Usuario registrado, quiero poder recuperar el acceso a mi cuenta si olvido mi contraseña, para no perder el acceso permanentemente.

#### Criterios de Aceptación

1. WHEN un Usuario solicita recuperación de contraseña con un email registrado, THE Sistema SHALL enviar un email con un enlace de recuperación dentro de los 60 segundos siguientes.
2. WHEN un Usuario solicita recuperación de contraseña con un email no registrado, THE Sistema SHALL retornar una respuesta genérica que no confirme ni niegue la existencia de la cuenta.
3. IF un enlace de recuperación de contraseña ha superado 1 hora desde su emisión, THEN THE Sistema SHALL rechazar su uso e indicar que el enlace expiró.
4. WHEN un Usuario utiliza un enlace de recuperación válido y establece una nueva contraseña, THE Sistema SHALL invalidar todos los Tokens_de_Refresco activos del Usuario.
5. WHEN un Usuario establece una nueva contraseña en el proceso de recuperación, THE Sistema SHALL verificar que cumpla los mismos criterios de seguridad definidos en el Requerimiento 4.

---

### Requerimiento 11: Compatibilidad Multiplataforma

**User Story:** Como Usuario, quiero acceder a la aplicación desde cualquier plataforma (web, iOS, Android, desktop), para tener una experiencia de login consistente independientemente del Dispositivo que use.

#### Criterios de Aceptación

1. THE Sistema SHALL exponer la funcionalidad de autenticación mediante una API REST que pueda ser consumida por clientes web, iOS, Android y desktop.
2. WHEN un cliente web realiza una solicitud de autenticación, THE Autenticador SHALL soportar almacenamiento de tokens mediante cookies HTTP-only seguras como alternativa al almacenamiento en el cliente.
3. THE Sistema SHALL incluir en todas las respuestas de autenticación los encabezados CORS necesarios para soportar clientes web en dominios configurados.
4. WHEN un Dispositivo móvil realiza una solicitud de autenticación, THE Autenticador SHALL aceptar tokens en el encabezado Authorization con esquema Bearer.

---

### Requerimiento 12: Seguridad y Auditoría

**User Story:** Como Administrador, quiero que el sistema registre eventos de seguridad relevantes, para poder auditar accesos y detectar comportamientos sospechosos.

#### Criterios de Aceptación

1. THE Sistema SHALL registrar en un log de auditoría cada evento de: autenticación exitosa, autenticación fallida, cierre de sesión, cambio de contraseña, creación de cuenta y cambio de Rol.
2. WHEN se registra un evento de auditoría, THE Sistema SHALL incluir: identificador del Usuario, tipo de evento, fecha y hora en UTC, dirección IP y plataforma del Dispositivo.
3. THE Sistema SHALL almacenar las contraseñas de los Usuarios exclusivamente como hash usando el algoritmo bcrypt con un factor de costo mínimo de 12.
4. IF el Sistema detecta más de 20 intentos de autenticación fallidos desde la misma dirección IP en un período de 5 minutos, THEN THE Sistema SHALL bloquear temporalmente las solicitudes de autenticación provenientes de esa dirección IP durante 30 minutos.
5. THE Sistema SHALL transmitir todos los datos de autenticación exclusivamente sobre conexiones HTTPS/TLS 1.2 o superior.
