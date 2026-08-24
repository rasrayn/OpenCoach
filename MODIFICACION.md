# MODIFICACION.md

## Objetivo del documento

Este archivo sirve como diario tecnico y didactico del proyecto. La idea es que cada cambio importante quede explicado de forma clara: que se ha hecho, por que se ha hecho asi, que mecanicas de trabajo se han usado y como se puede verificar que todo funciona.

El proyecto no es solo codigo: tambien es una forma de aprender arquitectura, testing, Git y buenas practicas de desarrollo paso a paso.

---

## Modificacion 1: Implementacion de `AuditService` (Tarea 4)

### Contexto

La tarea 4 del plan de implementacion pedia crear el servicio de auditoria:

- Implementar `AuditService.log`.
- Persistir eventos en la tabla `audit_logs`.
- Guardar los campos obligatorios:
  - `user_id`
  - `event_type`
  - `occurred_at` en UTC
  - `ip_address`
  - `device_info`
- Anadir una prueba de propiedad para comprobar que los eventos guardados contienen esos campos.

Esta parte corresponde a los requerimientos:

- 4.7: registrar fecha, hora y dispositivo cuando un usuario se autentica.
- 12.1: registrar eventos de seguridad relevantes.
- 12.2: incluir usuario, tipo de evento, fecha UTC, IP y plataforma/dispositivo.

---

## Que se ha creado

### 1. Puerto `IAuditRepository`

Archivo:

```text
src/modules/auth/application/ports/IAuditRepository.ts
```

Se creo una interfaz para separar la logica de aplicacion de la persistencia real:

```ts
export interface IAuditRepository {
  save(event: AuditEvent): Promise<void>
}
```

Esto significa que `AuditService` no necesita saber si los datos se guardan en PostgreSQL, en memoria, en un archivo o en otro sistema. Solo sabe que existe algo capaz de guardar un evento de auditoria.

Esta es una idea central de Clean Architecture: la aplicacion depende de contratos, no de detalles tecnicos.

---

### 2. Servicio `AuditService`

Archivo:

```text
src/modules/auth/application/services/AuditService.ts
```

Se implemento el servicio de aplicacion:

```ts
export class AuditService implements IAuditService {
  constructor(private readonly auditRepository: IAuditRepository) {}

  async log(event: AuditEvent): Promise<void> {
    this.assertRequiredFields(event)

    await this.auditRepository.save({
      ...event,
      occurredAt: new Date(event.occurredAt.toISOString()),
    })
  }
}
```

La responsabilidad de este servicio es:

- Recibir un `AuditEvent`.
- Validar que contiene los campos obligatorios.
- Normalizar `occurredAt` como fecha UTC.
- Delegar el guardado al repositorio.

Importante: `AuditService` no ejecuta SQL. Esa responsabilidad pertenece a infraestructura.

---

### 3. Adaptacion de `PostgresAuditRepository`

Archivo:

```text
src/modules/auth/infrastructure/persistence/PostgresAuditRepository.ts
```

Antes, este repositorio implementaba directamente `IAuditService`. Ahora implementa `IAuditRepository`.

Esto deja las responsabilidades mas limpias:

- `AuditService`: reglas de aplicacion y validacion.
- `PostgresAuditRepository`: guardado real en PostgreSQL.

El metodo principal ahora es:

```ts
async save(event: AuditEvent): Promise<void>
```

Internamente hace un `INSERT INTO audit_logs` usando parametros:

```sql
INSERT INTO audit_logs (user_id, event_type, occurred_at, ip_address, device_info, metadata)
VALUES ($1, $2, $3, $4, $5, $6)
```

Usar parametros como `$1`, `$2`, etc. evita concatenar strings manualmente y ayuda a prevenir inyeccion SQL.

---

### 4. Cableado en `main.ts`

Archivo:

```text
src/main.ts
```

Se cambio el composition root para instanciar primero el repositorio y luego el servicio:

```ts
const _auditRepository = new PostgresAuditRepository(dbPool)
const _auditService = new AuditService(_auditRepository)
```

Esto es importante porque `main.ts` es el lugar donde se conectan las piezas concretas. Las capas internas no deberian crear directamente sus dependencias.

---

### 5. Pruebas de `AuditService`

Archivo:

```text
src/modules/auth/application/services/__tests__/AuditService.test.ts
```

Se anadieron pruebas para verificar el comportamiento.

La prueba de propiedad genera muchos eventos arbitrarios y comprueba que el servicio siempre guarda los campos requeridos:

- `userId`
- `eventType`
- `occurredAt`
- `ipAddress`
- `deviceInfo`

Tambien se anadio una prueba especifica del repositorio PostgreSQL para comprobar que el `INSERT` incluye las columnas esperadas y los valores correctos.

---

## Mecanica de trabajo usada

### 1. Leer antes de tocar

Antes de modificar codigo se revisaron:

- `tasks.md`
- `requirements.md`
- `design.md`
- `IAuditService.ts`
- `PostgresAuditRepository.ts`
- tests existentes
- `main.ts`

Esto evita implementar algo que no encaje con el diseno del proyecto.

---

### 2. Cambios pequenos y acotados

La tarea era solo la numero 4, asi que no se avanzo a `RateLimitService` ni a otras partes del sistema.

Los cambios quedaron limitados a:

- Servicio de auditoria.
- Puerto de repositorio.
- Repositorio PostgreSQL de auditoria.
- Tests.
- Checklist de tareas.
- Cableado en `main.ts`.

---

### 3. Separacion de responsabilidades

Se aplico esta division:

```text
Application
  AuditService
  IAuditService
  IAuditRepository

Infrastructure
  PostgresAuditRepository
```

Esta separacion permite testear `AuditService` sin una base de datos real.

---

### 4. Pruebas antes de cerrar

Se ejecutaron:

```bash
npm run typecheck
npm test -- --runInBand
```

Resultado:

```text
2 test suites passed
28 tests passed
```

Esto confirma que:

- TypeScript compila sin errores.
- Las pruebas anteriores siguen pasando.
- Las nuevas pruebas de auditoria pasan.

---

## Git y Pull Request

Se creo una rama:

```text
feature/audit-service-task-4
```

Se creo un commit:

```text
7d2131b Implement AuditService logging
```

La rama se publico en GitHub:

```text
origin/feature/audit-service-task-4
```

La creacion automatica de la Pull Request desde la integracion fallo por permisos del plugin de GitHub, pero la rama si esta subida.

Enlace para crear la PR manualmente:

```text
https://github.com/rasrayn/OpenCoach/pull/new/feature/audit-service-task-4
```

---

## Que aprender de esta modificacion

### Clean Architecture en practica

Una regla clave es que las capas internas no deben depender de detalles externos.

Por eso:

- `AuditService` no sabe nada de PostgreSQL.
- `PostgresAuditRepository` no decide reglas de negocio.
- `main.ts` une las piezas.

---

### Por que usar interfaces

Las interfaces permiten cambiar implementaciones sin tocar la logica principal.

Por ejemplo, en tests se puede crear un repositorio falso:

```ts
const repository: IAuditRepository = {
  save: async (event) => {
    savedEvents.push(event)
  },
}
```

Asi se prueba el servicio sin levantar PostgreSQL.

---

### Por que hacer pruebas de propiedad

Una prueba normal verifica casos concretos.

Una prueba de propiedad verifica una regla general muchas veces con datos generados automaticamente.

En este caso, la propiedad es:

```text
Todo evento de auditoria guardado debe conservar los campos requeridos.
```

Esto da mas confianza que probar solo un evento escrito a mano.

---

## Estado final de la tarea 4

La tarea 4 queda completada:

- [x] `AuditService.log` implementado.
- [x] Persistencia en `audit_logs`.
- [x] Campos obligatorios incluidos.
- [x] Timestamp en UTC.
- [x] Prueba de propiedad anadida.
- [x] Typecheck correcto.
- [x] Tests correctos.
- [x] Rama publicada para Pull Request.

---

## Siguiente paso recomendado

La siguiente tarea del plan es:

```text
5. Implementar RateLimitService
```

Antes de empezar esa tarea conviene revisar:

- El contrato `IRateLimitService`.
- El diseno de claves Redis.
- Los requerimientos 4.5, 4.6 y 12.4.
- Como se van a testear los TTL y bloqueos sin depender necesariamente de Redis real.
