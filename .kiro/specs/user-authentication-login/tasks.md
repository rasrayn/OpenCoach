# Plan de Implementación: Sistema de Autenticación y Login de Usuarios

## Visión General

Este plan convierte el diseño técnico en pasos de codificación incrementales para un servicio de autenticación REST en TypeScript. Cada tarea construye sobre la anterior, comenzando por las interfaces y modelos de datos, luego la lógica de negocio de cada servicio, y finalmente la capa de presentación HTTP y el cableado final.

---

## Tareas

- [x] 1. Configurar estructura del proyecto e interfaces base
  - Crear la estructura de directorios siguiendo Monolito Modular con Clean Architecture:
    ```
    src/
      modules/
        auth/
          domain/
            entities/          # User, RefreshToken, EmailVerificationToken, PasswordResetToken
            value-objects/     # Email, Password, Role
            repositories/      # IUserRepository, ITokenRepository (interfaces)
            services/          # IPasswordHasher, ITokenSigner (interfaces)
            events/            # UserRegistered, PasswordChanged, AccountLocked (tipos)
          application/
            use-cases/         # LoginUseCase, RegisterCoachUseCase, CreateAthleteUseCase,
                               # CreateUserByAdminUseCase, RefreshTokenUseCase,
                               # ChangePasswordUseCase, ResetPasswordUseCase,
                               # VerifyEmailUseCase, RevokeSessionsUseCase
            ports/             # IEmailService, IRateLimitService, IAuditService (interfaces)
            dtos/              # DTOs internos de la capa de aplicación
          infrastructure/
            persistence/       # PostgresUserRepository, PostgresTokenRepository,
                               # PostgresAuditRepository, migrations/
            cache/             # RedisRateLimitService, RedisTokenCache
            email/             # NodemailerEmailService
            security/          # JwtTokenService, BcryptPasswordHasher
          presentation/
            controllers/       # AuthController, UserController
            middleware/        # AuthMiddleware (JWT), RoleGuard, CorsMiddleware
            dtos/              # Request/Response DTOs HTTP
            mappers/           # Mapeo entre DTOs HTTP y DTOs de aplicación
      shared/
        domain/                # Tipos compartidos, errores de dominio base
        infrastructure/        # Config, logger, conexión DB
      main.ts                  # Composition Root: instanciación y cableado de dependencias
    ```
  - Definir todas las interfaces TypeScript en la capa `domain/` y `application/ports/`: `IUserRepository`, `ITokenRepository`, `IPasswordHasher`, `ITokenSigner`, `IEmailService`, `IRateLimitService`, `IAuditService`
  - Definir las entidades y value objects del dominio: `User`, `Role`, `RefreshToken`, `Email`, `Password`, `PasswordPolicy`
  - Definir los tipos de transferencia (DTOs) en `application/dtos/` y `presentation/dtos/`: `LoginRequest`, `AuthResult`, `TokenPayload`, `UserSummary`, `CoachRegistrationData`, `AdminCreateUserData`, `CoachCreateAthleteData`, `PasswordValidationResult`, `AuditEvent`, `AuditEventType`
  - Configurar el framework de testing (Jest + fast-check)
  - _Requerimientos: 1.3, 2.2, 3.2, 4.8, 11.1_

- [x] 2. Implementar validación de contraseñas
  - [x] 2.1 Implementar la función `validatePassword`
    - Verificar longitud mínima de 8 caracteres, letra mayúscula, letra minúscula, dígito numérico y carácter especial
    - Retornar `{ valid: boolean, errors: string[] }` con exactamente los criterios incumplidos
    - _Requerimientos: 4.8, 4.9_

  - [x] 2.2 Escribir prueba de propiedad para `validatePassword`
    - **Propiedad 1: Validación de contraseña es exhaustiva y coherente**
    - Generar cadenas arbitrarias con fast-check y verificar que `valid=true` ↔ todos los criterios se cumplen simultáneamente, y que `errors` contiene exactamente los criterios incumplidos
    - **Valida: Requerimientos 1.3, 2.2, 3.2, 4.8, 4.9, 6.2, 7.4, 10.5**

- [x] 3. Implementar modelos de datos y migraciones
  - [x] 3.1 Crear las migraciones SQL para las tablas del diseño
    - Tablas: `users`, `coach_profiles`, `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`, `audit_logs`
    - Incluir constraints, índices y relaciones según el diseño
    - _Requerimientos: 1.6, 3.4, 5.4, 8.6, 12.1, 12.3_

  - [x] 3.2 Implementar las clases/repositorios de acceso a datos
    - Repositorios para cada entidad con métodos CRUD básicos
    - Usar consultas parametrizadas para prevenir inyección SQL
    - _Requerimientos: 1.4, 2.4, 3.3, 12.3_

- [x] 4. Implementar `AuditService`
  - [x] 4.1 Implementar el método `AuditService.log`
    - Persistir eventos en `audit_logs` con todos los campos requeridos: `user_id`, `event_type`, `occurred_at` (UTC), `ip_address`, `device_info`
    - _Requerimientos: 4.7, 12.1, 12.2_

  - [x]* 4.2 Escribir prueba de propiedad para `AuditService`
    - **Propiedad 8: El log de auditoría contiene todos los campos requeridos para cada evento**
    - Generar eventos arbitrarios de cada `AuditEventType` y verificar que el registro persistido contiene todos los campos obligatorios
    - **Valida: Requerimientos 4.7, 12.1, 12.2**

- [x] 5. Implementar `RateLimitService`
  - [x] 5.1 Implementar bloqueo de cuenta por intentos fallidos
    - Clave Redis `account_fail:{email}` con contador y TTL deslizante de 10 minutos
    - Al alcanzar 5 intentos: establecer `account_block:{email}` con TTL = 900 s
    - Implementar `recordFailedAttempt`, `isAccountBlocked` y `resetAccountAttempts`
    - _Requerimientos: 4.5, 4.6_

  - [x] 5.2 Implementar bloqueo por IP
    - Clave Redis `ip_fail:{ip}` con contador y TTL deslizante de 5 minutos
    - Al alcanzar 20 intentos: establecer `ip_block:{ip}` con TTL = 1800 s
    - Implementar `recordIpAttempt` e `isIpBlocked`
    - _Requerimientos: 12.4_

  - [x]* 5.3 Escribir prueba de propiedad para bloqueo de cuenta
    - **Propiedad 7: El bloqueo de cuenta por intentos fallidos se activa y respeta correctamente**
    - Simular secuencias de intentos fallidos y verificar umbral de bloqueo, respuesta HTTP 429 con tiempo restante, y restauración tras expiración del TTL
    - **Valida: Requerimientos 4.5, 4.6**

  - [x]* 5.4 Escribir prueba de propiedad para bloqueo por IP
    - **Propiedad 23: El bloqueo por IP se activa tras 20 intentos fallidos en 5 minutos**
    - Verificar que exactamente 20 intentos fallidos desde la misma IP activan el bloqueo de 30 minutos con HTTP 429
    - **Valida: Requerimiento 12.4**

- [x] 6. Punto de control — verificar servicios de infraestructura
  - Asegurarse de que todas las pruebas pasen hasta este punto; consultar al usuario si surgen dudas.

- [x] 7. Implementar `TokenService`
  - [x] 7.1 Implementar emisión y verificación de access tokens JWT (RS256)
    - `issueAccessToken(payload)`: emitir JWT con expiración de 15 minutos y claim `jti` único
    - `verifyAccessToken(token)`: verificar firma y expiración, retornar payload
    - _Requerimientos: 4.1, 4.2, 4.3_

  - [x] 7.2 Implementar emisión y rotación de refresh tokens
    - `issueRefreshToken(userId, deviceId, role)`: generar token opaco, almacenar su SHA-256 en DB con `expires_at` según rol (NULL para ATHLETE, 7 días para COACH, 1 día para ADMIN)
    - `verifyAndConsumeRefreshToken(token)`: buscar hash en DB, validar estado y expiración, marcar como revocado (rotación)
    - `revokeRefreshToken(tokenId)` y `revokeAllUserRefreshTokens(userId)`
    - _Requerimientos: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x]* 7.3 Escribir prueba de propiedad para duración de refresh tokens por rol
    - **Propiedad 5: La duración del refresh token es coherente con el rol del usuario**
    - Para cualquier login exitoso, verificar `expires_at` según rol: NULL para ATHLETE, ≈7 días para COACH, ≈1 día para ADMIN; access token siempre 15 min
    - **Valida: Requerimientos 4.1, 4.2, 4.3**

  - [x]* 7.4 Escribir prueba de propiedad para refresco de token
    - **Propiedad 16: El refresco de token respeta el estado y expiración del refresh token**
    - Verificar que tokens revocados o expirados (según rol) resultan en HTTP 401, y tokens válidos emiten nuevo access token
    - **Valida: Requerimientos 8.1, 8.2, 8.3, 8.4**

- [x] 8. Implementar `RoleService`
  - [x] 8.1 Implementar `canCreateRole` y `validatePermission`
    - `canCreateRole(requesterRole, targetRole)`: ADMIN puede crear cualquier rol; COACH puede crear ATHLETE; ATHLETE no puede crear ninguno; registro público solo COACH
    - `validatePermission(userId, requiredRole)`: verificar que el usuario tiene el rol requerido
    - _Requerimientos: 1.1, 1.2, 1.7, 2.7, 3.1, 3.7, 9.3, 9.4, 9.5_

  - [x] 8.2 Implementar `assignRole`
    - Modificar el rol de un usuario en DB; verificar que el solicitante es ADMIN
    - _Requerimientos: 9.2, 9.3_

  - [x]* 8.3 Escribir prueba de propiedad para permisos de creación de cuentas
    - **Propiedad 3: Los permisos de creación de cuenta respetan la jerarquía de roles**
    - Para cualquier combinación de rol solicitante y rol objetivo, verificar la tabla de permisos; intentos fuera de las reglas deben retornar HTTP 403
    - **Valida: Requerimientos 1.1, 1.2, 1.7, 2.7, 3.1, 3.7**

  - [x]* 8.4 Escribir prueba de propiedad para modificación de roles
    - **Propiedad 20: Solo los Administradores pueden modificar roles**
    - Para cualquier usuario con rol COACH o ATHLETE que intente modificar roles, verificar rechazo con HTTP 403
    - **Valida: Requerimientos 9.4, 9.5**

  - [x]* 8.5 Escribir prueba de propiedad para roles válidos del sistema
    - **Propiedad 19: Solo los roles válidos del sistema son aceptados**
    - Para cualquier valor de rol fuera de `{ADMIN, COACH, ATHLETE}`, verificar error de validación
    - **Valida: Requerimiento 9.1**

- [ ] 9. Implementar `UserService`
  - [ ] 9.1 Implementar `registerCoach`
    - Validar email único, validar contraseña, hashear con bcrypt (factor 12), insertar en `users` (role=COACH), insertar en `coach_profiles` con campos opcionales
    - _Requerimientos: 2.1, 2.2, 2.3, 2.4, 2.5, 12.3_

  - [ ]* 9.2 Escribir prueba de propiedad para perfil de entrenador
    - **Propiedad 9: El perfil de entrenador acepta cualquier combinación de campos opcionales**
    - Generar combinaciones arbitrarias de `gymName` y `program` (presentes/ausentes) y verificar que el registro siempre se completa exitosamente
    - **Valida: Requerimiento 2.3**

  - [ ] 9.3 Implementar `createUserByAdmin`
    - Validar que el solicitante es ADMIN, validar email único, validar contraseña, hashear con bcrypt (factor 12), insertar usuario con rol indicado (ADMIN o COACH), activar cuenta de inmediato
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [ ] 9.4 Implementar `createAthleteByCoach`
    - Validar que el solicitante es COACH, validar email único, validar contraseña, hashear con bcrypt (factor 12), insertar usuario con role=ATHLETE e `isFirstAccess=true`, activar cuenta de inmediato
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [ ]* 9.5 Escribir prueba de propiedad para creación de cuenta y rol asignado
    - **Propiedad 2: La creación de cuenta asigna exactamente el rol solicitado**
    - Para cualquier combinación válida de datos de creación, verificar que la cuenta creada tiene exactamente el rol indicado y está activa
    - **Valida: Requerimientos 1.6, 2.5**

  - [ ]* 9.6 Escribir prueba de propiedad para indicador de Primer_Acceso en Atleta
    - **Propiedad 4: La cuenta de Atleta creada por Entrenador tiene Primer_Acceso activado**
    - Para cualquier Atleta creado por un Entrenador, verificar `isFirstAccess=true` y `role=ATHLETE`
    - **Valida: Requerimiento 3.4**

  - [ ]* 9.7 Escribir prueba de propiedad para almacenamiento de contraseñas
    - **Propiedad 22: Las contraseñas se almacenan exclusivamente como hash bcrypt con factor ≥ 12**
    - Para cualquier contraseña creada o actualizada, verificar que `password_hash` es un hash bcrypt válido con cost factor ≥ 12 y nunca texto plano
    - **Valida: Requerimiento 12.3**

- [ ] 10. Implementar `EmailService`
  - [ ] 10.1 Implementar `sendVerificationEmail`
    - Generar token de verificación opaco, almacenar su SHA-256 en `email_verification_tokens` con TTL de 24 horas, enviar email con enlace de verificación
    - _Requerimientos: 2.6, 3.5, 3.6, 5.2, 5.3_

  - [ ] 10.2 Implementar `sendCredentialsEmail`
    - Enviar email con credenciales al usuario recién creado dentro de 60 segundos
    - _Requerimientos: 1.5, 3.5_

  - [ ] 10.3 Implementar `sendPasswordResetEmail`
    - Generar token de recuperación opaco, almacenar su SHA-256 en `password_reset_tokens` con TTL de 1 hora, enviar email con enlace de recuperación
    - _Requerimientos: 10.1_

- [ ] 11. Implementar lógica de verificación de email y recuperación de contraseña
  - [ ] 11.1 Implementar endpoint de verificación de email (`GET /auth/email/verify/:token`)
    - Buscar token por SHA-256, validar que no esté usado ni expirado, marcar `email_verified=true` y `used_at=NOW()` en el token
    - _Requerimientos: 5.4, 5.5, 5.6, 5.7_

  - [ ]* 11.2 Escribir prueba de propiedad para uso único de token de verificación
    - **Propiedad 10: Un token de verificación de email solo puede usarse una vez**
    - Verificar que el primer uso marca el email como verificado y el segundo uso retorna error de "enlace ya utilizado"
    - **Valida: Requerimientos 5.4, 5.5**

  - [ ]* 11.3 Escribir prueba de propiedad para tokens expirados
    - **Propiedad 11: Los tokens de verificación y recuperación expirados son rechazados**
    - Para tokens con `expires_at` en el pasado, verificar rechazo con mensaje de enlace expirado
    - **Valida: Requerimientos 5.7, 10.3**

  - [ ] 11.4 Implementar reenvío de email de verificación (`POST /auth/email/resend-verification`)
    - Invalidar token anterior (establecer `used_at=NOW()`), emitir y enviar nuevo token
    - _Requerimientos: 5.8_

  - [ ]* 11.5 Escribir prueba de propiedad para reenvío de verificación
    - **Propiedad 12: El reenvío de verificación invalida el token anterior**
    - Para cualquier usuario con token previo (usado o no), verificar que tras el reenvío el token anterior queda invalidado y solo el nuevo es válido
    - **Valida: Requerimiento 5.8**

  - [ ] 11.6 Implementar solicitud de recuperación de contraseña (`POST /auth/password/forgot`)
    - Retornar respuesta genérica independientemente de si el email existe; si existe, enviar email de recuperación
    - _Requerimientos: 10.1, 10.2_

  - [ ]* 11.7 Escribir prueba de propiedad para respuesta indistinguible en recuperación
    - **Propiedad 21: La respuesta de recuperación de contraseña es indistinguible para emails registrados y no registrados**
    - Para un email registrado y uno no registrado, verificar que la respuesta HTTP (código y cuerpo) es textualmente idéntica
    - **Valida: Requerimiento 10.2**

  - [ ] 11.8 Implementar reset de contraseña con token (`POST /auth/password/reset`)
    - Validar token de recuperación, validar nueva contraseña, hashear con bcrypt, actualizar `password_hash`, revocar todos los refresh tokens activos, marcar token como usado
    - _Requerimientos: 10.3, 10.4, 10.5_

- [ ] 12. Punto de control — verificar servicios de dominio
  - Asegurarse de que todas las pruebas pasen hasta este punto; consultar al usuario si surgen dudas.

- [ ] 13. Implementar `AuthService` (login, logout y cambio de contraseña)
  - [ ] 13.1 Implementar `AuthService.login`
    - Verificar bloqueo de IP y de cuenta, buscar usuario por email, verificar contraseña con bcrypt, registrar intento fallido o exitoso en RateLimitService y AuditService, emitir access token y refresh token, registrar evento `AUTH_SUCCESS`
    - _Requerimientos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 12.1, 12.2_

  - [ ]* 13.2 Escribir prueba de propiedad para mensaje de error genérico en credenciales incorrectas
    - **Propiedad 6: El mensaje de error de credenciales incorrectas no revela qué campo falló**
    - Verificar que el error para email incorrecto y el error para contraseña incorrecta son textualmente idénticos, ambos con HTTP 401
    - **Valida: Requerimiento 4.4**

  - [ ] 13.3 Implementar `AuthService.logout`
    - Revocar el refresh token del dispositivo actual, registrar evento `LOGOUT` en AuditService
    - _Requerimientos: 8.5_

  - [ ] 13.4 Implementar `AuthService.refreshAccessToken`
    - Verificar y consumir refresh token (rotación), emitir nuevo access token y nuevo refresh token
    - _Requerimientos: 8.1, 8.2, 8.3, 8.4_

  - [ ] 13.5 Implementar `AuthService.revokeAllSessions`
    - Revocar todos los refresh tokens del usuario en todos los dispositivos
    - _Requerimientos: 8.7_

  - [ ] 13.6 Implementar cambio de contraseña para usuario autenticado (`POST /auth/password/change`)
    - Verificar contraseña actual con bcrypt, validar nueva contraseña, hashear, actualizar `password_hash`, revocar todos los refresh tokens, eliminar `isFirstAccess` si es ATHLETE, registrar evento `PASSWORD_CHANGE` en AuditService
    - _Requerimientos: 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 13.7 Escribir prueba de propiedad para verificación de contraseña actual obligatoria
    - **Propiedad 15: La verificación de contraseña actual es obligatoria antes de un cambio**
    - Para cualquier usuario autenticado con contraseña actual incorrecta, verificar rechazo con mensaje genérico y contraseña sin modificar
    - **Valida: Requerimientos 7.2, 7.3**

  - [ ]* 13.8 Escribir prueba de propiedad para revocación de tokens tras cambio de contraseña
    - **Propiedad 13: Cambiar la contraseña revoca todos los refresh tokens activos**
    - Para cualquier usuario con N ≥ 0 refresh tokens activos en cualquier número de dispositivos, verificar que tras el cambio de contraseña el conteo de tokens activos es 0
    - **Valida: Requerimientos 6.4, 7.5, 10.4**

  - [ ]* 13.9 Escribir prueba de propiedad para eliminación de Primer_Acceso en Atleta
    - **Propiedad 14: Cambiar la contraseña de un Atleta elimina el indicador de Primer_Acceso**
    - Para cualquier Atleta con `isFirstAccess=true`, verificar que tras establecer nueva contraseña válida `isFirstAccess=false`
    - **Valida: Requerimiento 6.3**

- [ ] 14. Implementar `AuthController` y middleware HTTP
  - [ ] 14.1 Implementar middleware de autenticación JWT
    - Extraer y verificar el access token del header `Authorization: Bearer` o de la cookie `__Secure-refresh_token` (clientes web)
    - Rechazar con 401 si el token es inválido o expirado
    - _Requerimientos: 4.1, 4.2, 4.3, 11.2, 11.4_

  - [ ] 14.2 Implementar middleware de autorización por rol
    - Verificar que el usuario autenticado tiene el rol requerido para el endpoint; retornar HTTP 403 si no
    - _Requerimientos: 1.7, 3.7, 9.4, 9.5, 9.6_

  - [ ] 14.3 Implementar middleware de CORS
    - Añadir encabezados CORS en todas las respuestas de autenticación para los dominios configurados
    - _Requerimientos: 11.3_

  - [ ]* 14.4 Escribir prueba de propiedad para headers CORS
    - **Propiedad 24: Los headers CORS están presentes en todas las respuestas de autenticación**
    - Para cualquier solicitud a los endpoints de autenticación, verificar que la respuesta incluye los encabezados CORS configurados
    - **Valida: Requerimiento 11.3**

  - [ ] 14.5 Implementar todos los endpoints REST del `AuthController`
    - Rutas: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/token/refresh`, `POST /auth/password/change`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `GET /auth/email/verify/:token`, `POST /auth/email/resend-verification`, `POST /users`, `PATCH /users/:id/role`, `DELETE /auth/sessions`
    - Validar entradas, delegar a servicios, retornar respuestas con códigos HTTP correctos según el catálogo de errores del diseño
    - _Requerimientos: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 11.4_

  - [ ] 14.6 Implementar soporte de cookies HTTP-only para clientes web
    - Al autenticar desde cliente web, establecer el refresh token en cookie `__Secure-refresh_token` (HttpOnly, Secure, SameSite=Strict)
    - Para clientes móviles, retornar el refresh token en el cuerpo de la respuesta
    - _Requerimientos: 11.2, 11.4_

- [ ] 15. Implementar notificación de Primer_Acceso para Atleta
  - Añadir campo `isFirstAccess` en la respuesta `UserSummary` del login
  - El cliente puede usar este indicador para mostrar la notificación de cambio de contraseña recomendado
  - _Requerimientos: 6.1, 6.5_

- [ ] 16. Pruebas de integración
  - [ ]* 16.1 Escribir prueba de integración para el flujo completo de registro de Entrenador
    - Registro → envío de email de verificación → verificación de email → login exitoso
    - _Requerimientos: 2.1, 2.5, 2.6, 5.1, 5.4_

  - [ ]* 16.2 Escribir prueba de integración para flujo de creación de cuenta por Administrador
    - Login como Admin → crear Entrenador → recepción de email con credenciales → login como Entrenador
    - _Requerimientos: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 16.3 Escribir prueba de integración para flujo de creación de Atleta por Entrenador
    - Login como Entrenador → crear Atleta → login como Atleta → verificar `isFirstAccess=true` → cambiar contraseña → verificar `isFirstAccess=false`
    - _Requerimientos: 3.1, 3.4, 6.1, 6.3, 6.4_

  - [ ]* 16.4 Escribir prueba de integración para recuperación de contraseña
    - Solicitar recuperación → recibir email → usar enlace → establecer nueva contraseña → verificar revocación de tokens → login con nueva contraseña
    - _Requerimientos: 10.1, 10.3, 10.4, 10.5_

  - [ ]* 16.5 Escribir prueba de propiedad para cierre de sesión en dispositivo específico
    - **Propiedad 17: El cierre de sesión revoca exactamente el token del dispositivo actual**
    - Para cualquier usuario con sesiones activas en múltiples dispositivos, verificar que logout solo revoca el token del dispositivo actual y los demás permanecen activos
    - **Valida: Requerimientos 8.5, 8.6**

  - [ ]* 16.6 Escribir prueba de propiedad para revocación total de sesiones
    - **Propiedad 18: La revocación total de sesiones invalida todos los refresh tokens**
    - Para cualquier usuario con N ≥ 1 tokens activos en múltiples dispositivos, verificar que `DELETE /auth/sessions` deja el conteo de tokens activos en 0
    - **Valida: Requerimiento 8.7**

- [ ] 17. Punto de control final — verificar sistema completo
  - Asegurarse de que todas las pruebas pasan; revisar la cobertura de requerimientos; consultar al usuario si surgen dudas.

---

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para una implementación MVP más rápida.
- Cada tarea referencia los requerimientos específicos para trazabilidad completa.
- Los checkpoints garantizan validación incremental en puntos clave del desarrollo.
- Las pruebas de propiedad usan `fast-check` y deben ejecutar mínimo 100 iteraciones cada una.
- Las pruebas unitarias y de propiedad son complementarias: las de propiedad verifican invariantes universales, las unitarias verifican casos concretos y aristas.
- Todos los endpoints deben exponer únicamente HTTPS/TLS 1.2+ (Requerimiento 12.5).
