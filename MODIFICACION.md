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

---

## Modificacion 2: Implementacion de `RateLimitService` (Tarea 5)

### Contexto

La tarea 5 pedia implementar la proteccion contra fuerza bruta:

- Bloqueo de cuenta tras 5 intentos fallidos en 10 minutos.
- Bloqueo temporal de la cuenta durante 15 minutos.
- Bloqueo de IP tras 20 intentos fallidos en 5 minutos.
- Bloqueo temporal de la IP durante 30 minutos.
- Tests de propiedad para comprobar los umbrales y expiraciones.

Esta parte corresponde a los requerimientos:

- 4.5: bloquear una cuenta tras 5 intentos fallidos consecutivos en 10 minutos.
- 4.6: rechazar intentos mientras la cuenta esta bloqueada e indicar tiempo restante.
- 12.4: bloquear una IP tras mas intentos fallidos desde la misma direccion.

---

## Que se ha creado

### 1. Implementacion de `RedisRateLimitService`

Archivo:

```text
src/modules/auth/infrastructure/cache/RedisRateLimitService.ts
```

El servicio ahora implementa todos los metodos del puerto `IRateLimitService`:

```ts
recordFailedAttempt(accountKey: string): Promise<void>
isAccountBlocked(accountKey: string): Promise<{ blocked: boolean; remainingSeconds?: number }>
resetAccountAttempts(accountKey: string): Promise<void>
recordIpAttempt(ip: string): Promise<void>
isIpBlocked(ip: string): Promise<{ blocked: boolean; remainingSeconds?: number }>
```

Antes estos metodos lanzaban errores de "Not implemented". Ahora contienen la logica de conteo, TTL y bloqueo.

---

### 2. Claves usadas para rate limiting

Se siguio el diseno indicado:

```text
account_fail:{email}
account_block:{email}
ip_fail:{ip}
ip_block:{ip}
```

Cada tipo de clave tiene una responsabilidad:

- `account_fail:{email}` cuenta intentos fallidos de una cuenta.
- `account_block:{email}` indica que una cuenta esta bloqueada.
- `ip_fail:{ip}` cuenta intentos fallidos desde una IP.
- `ip_block:{ip}` indica que una IP esta bloqueada.

---

### 3. Umbrales y duraciones

Se definieron constantes dentro de `RedisRateLimitService`:

```ts
static readonly ACCOUNT_FAILURE_WINDOW_SECONDS = 600
static readonly ACCOUNT_BLOCK_SECONDS = 900
static readonly ACCOUNT_FAILURE_THRESHOLD = 5

static readonly IP_FAILURE_WINDOW_SECONDS = 300
static readonly IP_BLOCK_SECONDS = 1800
static readonly IP_FAILURE_THRESHOLD = 20
```

Esto evita numeros magicos dentro del codigo.

Leer `900` suelto no explica mucho. Leer `ACCOUNT_BLOCK_SECONDS` si explica la intencion.

---

### 4. TTL deslizante

El contador de fallos usa TTL deslizante.

Eso significa que cada intento fallido renueva la ventana de tiempo:

```ts
await this.store.increment(failKey)
await this.store.expire(failKey, RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS)
```

Ejemplo con cuenta:

1. Primer fallo: se crea `account_fail:email` con TTL de 10 minutos.
2. Segundo fallo: sube el contador y se renueva el TTL a otros 10 minutos.
3. Al quinto fallo: se crea `account_block:email` con TTL de 15 minutos.

---

### 5. Interfaz `RateLimitStore`

Como el proyecto todavia no tiene dependencia real de Redis instalada, se creo una interfaz pequena:

```ts
export interface RateLimitStore {
  increment(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  setWithExpiry(key: string, value: string, seconds: number): Promise<void>
  ttl(key: string): Promise<number>
  delete(key: string): Promise<void>
}
```

Esto permite que `RedisRateLimitService` dependa de operaciones tipo Redis sin acoplarse a una libreria concreta.

Mas adelante se puede crear un adaptador para un cliente Redis real que implemente esta interfaz.

---

### 6. Almacen en memoria para tests y desarrollo

Tambien se creo `InMemoryRateLimitStore`.

Su funcion es simular el comportamiento basico de Redis:

- Incrementar contadores.
- Guardar claves con expiracion.
- Calcular TTL restante.
- Eliminar claves expiradas.

Esto permite probar la logica sin necesitar un servidor Redis funcionando.

Importante: esto no reemplaza Redis en produccion. Es una herramienta de desarrollo y pruebas.

---

## Pruebas anadidas

Archivo:

```text
src/modules/auth/infrastructure/cache/__tests__/RedisRateLimitService.test.ts
```

Se anadieron tests para:

- Bloquear una cuenta exactamente al quinto intento fallido.
- Verificar que antes del quinto intento la cuenta no esta bloqueada.
- Verificar que la cuenta se desbloquea al pasar el TTL de 15 minutos.
- Verificar que `resetAccountAttempts` limpia los intentos acumulados.
- Bloquear una IP exactamente al intento numero 20.
- Verificar que la IP se desbloquea al pasar el TTL de 30 minutos.

---

## Por que se uso un reloj controlado

Esperar 15 o 30 minutos reales en un test seria inviable.

Por eso el servicio acepta una funcion `now`:

```ts
constructor(store?: RateLimitStore, now: () => number = Date.now)
```

En produccion usa `Date.now`.

En tests se usa una variable:

```ts
let now = 0
const service = new RedisRateLimitService(undefined, () => now)
```

Asi el test puede avanzar el tiempo manualmente:

```ts
now += RedisRateLimitService.ACCOUNT_BLOCK_SECONDS * 1000
```

Esta tecnica hace que los tests sean rapidos, deterministas y faciles de razonar.

---

## Mecanica de trabajo usada

### 1. Implementar sobre el contrato existente

No se cambio `IRateLimitService`.

Esto es importante porque los futuros casos de uso, como `AuthService.login`, ya podran depender de ese contrato sin saber nada de Redis.

---

### 2. Evitar dependencias prematuras

Como `package.json` no incluye una libreria Redis, no se instalo ninguna nueva dependencia.

La decision fue crear un contrato minimo (`RateLimitStore`) e implementar una version en memoria.

Ventaja:

- El codigo compila y se prueba ya.
- El diseno sigue preparado para Redis real.
- No se introduce complejidad antes de necesitarla.

---

### 3. Probar comportamiento, no implementacion interna

Los tests no comprueban directamente el mapa interno del almacen en memoria.

Comprueban el comportamiento visible:

- Si esta bloqueado o no.
- Cuantos segundos quedan.
- Si expira correctamente.

Esto hace que los tests sigan siendo utiles aunque en el futuro se cambie la implementacion interna.

---

## Verificacion

Se ejecutaron:

```bash
npm run typecheck
npm test -- --runInBand
```

Resultado:

```text
3 test suites passed
34 tests passed
```

Esto confirma que:

- TypeScript compila correctamente.
- Las pruebas anteriores siguen funcionando.
- Las pruebas nuevas del rate limit pasan.

---

## Estado final de la tarea 5

La tarea 5 queda completada:

- [x] Bloqueo de cuenta por intentos fallidos.
- [x] TTL deslizante de 10 minutos para intentos de cuenta.
- [x] Bloqueo de cuenta de 15 minutos.
- [x] `recordFailedAttempt` implementado.
- [x] `isAccountBlocked` implementado.
- [x] `resetAccountAttempts` implementado.
- [x] Bloqueo por IP.
- [x] TTL deslizante de 5 minutos para intentos por IP.
- [x] Bloqueo por IP de 30 minutos.
- [x] `recordIpAttempt` implementado.
- [x] `isIpBlocked` implementado.
- [x] Tests de propiedad anadidos.
- [x] Typecheck correcto.
- [x] Tests correctos.

---

## Siguiente paso recomendado

La siguiente tarea del plan es:

```text
6. Punto de control - verificar servicios de infraestructura
```

Como ya se ejecutaron `typecheck` y tests, esta tarea probablemente consistira en revisar el estado acumulado de las tareas 4 y 5, confirmar que no hay dudas abiertas y dejar preparado el paso hacia `TokenService`.

---

## Criterio de testing para las siguientes tareas

A partir de ahora el proyecto seguira como referencia la piramide de testing:

```text
        / E2E \
       /------\
      / Integr.\
     /----------\
    / Unit Tests \
   /--------------\
```

Distribucion orientativa:

- Unit tests: muchas pruebas, aproximadamente 60-70%.
- Integration tests: cantidad moderada, aproximadamente 20-30%.
- E2E tests: pocas pruebas, aproximadamente 5-10%.

---

## Como aplicarlo en este proyecto

### 1. Priorizar unit tests

La mayor parte de la logica debe probarse con unit tests porque son:

- Rapidos.
- Faciles de ejecutar.
- Faciles de depurar.
- Buenos para reglas de negocio aisladas.

Ejemplos adecuados:

- Validacion de password.
- Calculo de expiracion de tokens.
- Reglas de roles.
- Bloqueo por intentos fallidos.
- Normalizacion de eventos de auditoria.

---

### 2. Usar integration tests cuando haya colaboracion real entre piezas

Los tests de integracion deben comprobar que varias partes colaboran correctamente.

Ejemplos adecuados:

- Caso de uso + repositorio en memoria.
- Servicio de autenticacion + token service + rate limit.
- Repositorio PostgreSQL contra una base de datos de test.
- Flujo de email verification usando repositorios reales o dobles controlados.

No deben duplicar todos los casos unitarios. Deben centrarse en las uniones importantes.

---

### 3. Mantener pocos E2E tests

Los E2E son valiosos, pero son mas lentos y fragiles.

Se usaran para flujos completos realmente criticos:

- Registro completo de entrenador.
- Login completo.
- Recuperacion de contrasena.
- Creacion de atleta por entrenador.
- Cambio de contrasena en primer acceso.

La idea no es cubrir todas las combinaciones con E2E, sino comprobar que los caminos principales del sistema estan conectados de extremo a extremo.

---

## Evitar tests solo del happy path

Una regla importante para este proyecto: evitar tests que solo demuestran que "todo va bien cuando todo es correcto".

El happy path puede existir, pero no debe ser el centro de la estrategia.

Para cada funcionalidad nueva intentaremos pensar tambien:

- Que pasa si falta un dato obligatorio.
- Que pasa si el usuario no tiene permisos.
- Que pasa si el token esta expirado.
- Que pasa si el recurso ya fue usado.
- Que pasa si se supera un limite.
- Que pasa si hay datos validos pero en una combinacion no permitida.

Esto ayuda a aprender una idea clave: un sistema robusto no se valida solo por lo que permite, sino tambien por lo que rechaza correctamente.

---

## Regla practica para proximas tareas

Cuando implementemos una tarea nueva, intentaremos dejar al menos:

- Unit tests para reglas internas.
- Tests de propiedad cuando exista una invariante clara.
- Integration tests solo si la tarea une varias piezas importantes.
- E2E tests solo para flujos completos de alto valor.

Y siempre que sea posible, los tests deben comprobar comportamiento observable, no detalles internos de implementacion.

---

## Correccion de testing: ventana de bloqueo de login

Durante la revision de los tests de `RedisRateLimitService` se detecto un error conceptual importante.

El test original usaba un generador parecido a:

```ts
fc.integer({ min: 1, max: 599 })
```

La intencion era probar que los intentos fallidos estaban dentro de una ventana de 10 minutos.

Pero ese generador solo garantizaba que cada separacion individual entre intentos fuese menor que 600 segundos.

Eso no garantiza que todos los intentos esten dentro de la misma ventana total de 10 minutos.

Ejemplo:

```text
Intento 1 -> segundo 0
Intento 2 -> segundo 599
Intento 3 -> segundo 1198
Intento 4 -> segundo 1797
Intento 5 -> segundo 2396
```

Cada salto individual es menor de 10 minutos, pero el conjunto completo no ocurre dentro de los mismos 10 minutos.

---

## Como se corrigio

Se cambio el test para generar directamente offsets de tiempo dentro de la ventana:

```ts
fc
  .array(fc.integer({ min: 0, max: RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS - 1 }), {
    minLength: RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1,
    maxLength: RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1,
  })
  .map((offsets) => offsets.sort((a, b) => a - b))
```

Esto garantiza por construccion que todos los intentos generados ocurren entre el segundo 0 y el segundo 599.

La diferencia es importante:

- Antes se controlaba cada intervalo por separado.
- Ahora se controla la posicion real de cada intento dentro de la ventana.

---

## Test que faltaba

Tambien faltaba comprobar que los intentos antiguos salen de la ventana.

Se anadio este caso:

```text
00:00 -> intento
00:01 -> intento
00:02 -> intento
00:03 -> intento

pasan mas de 10 minutos

00:14 -> intento
```

El sistema no debe bloquear la cuenta en ese quinto intento, porque los cuatro intentos anteriores ya expiraron.

Este test es especialmente valioso porque comprueba el comportamiento negativo:

```text
No debe bloquear si los intentos acumulados ya no pertenecen a la ventana valida.
```

Esto encaja con la regla que hemos definido: no quedarnos solo con happy paths.

---

## Leccion aprendida

Cuando hacemos tests con generadores, no basta con que los datos parezcan razonables.

Hay que preguntarse:

- Que propiedad exacta quiero demostrar.
- Que garantiza matematicamente mi generador.
- Si estoy comprobando el caso que realmente da valor.

En este caso, la propiedad correcta no era:

```text
Cada separacion entre intentos es menor de 10 minutos.
```

La propiedad correcta era:

```text
Los intentos que causan el bloqueo pertenecen a la ventana temporal valida.
```

Y ademas:

```text
Los intentos expirados no contribuyen al bloqueo.
```

Verificacion tras la correccion:

```bash
npm test -- --runInBand src/modules/auth/infrastructure/cache/__tests__/RedisRateLimitService.test.ts
npm run typecheck
```

Resultado:

```text
RateLimitService tests passed
Typecheck passed
```
