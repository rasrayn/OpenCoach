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

### 4. Sliding window real

La primera aproximacion usaba un contador con TTL deslizante. Eso era util, pero tenia un matiz importante: no era una sliding window real.

Un contador con TTL renovado puede terminar contando intentos repartidos durante mucho mas de 10 minutos, siempre que entre un intento y el siguiente no pase el TTL completo.

Para cumplir mejor el requisito de "5 intentos en un periodo de 10 minutos", el store ahora registra timestamps de intentos:

```ts
recordAttempt(key: string, occurredAt: number, windowSeconds: number): Promise<number>
```

Cada vez que llega un intento:

1. Se calcula el inicio de la ventana.
2. Se eliminan los intentos anteriores a esa ventana.
3. Se anade el intento actual.
4. Se devuelve cuantos intentos siguen activos dentro de la ventana.

Conceptualmente:

```text
ventana valida = [ahora - 10 minutos, ahora]
```

Solo los intentos dentro de esa ventana cuentan para decidir si se bloquea la cuenta.

---

### 5. Interfaz `RateLimitStore`

Como el proyecto todavia no tiene dependencia real de Redis instalada, se creo una interfaz pequena:

```ts
export interface RateLimitStore {
  recordAttempt(key: string, occurredAt: number, windowSeconds: number): Promise<number>
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

- Guardar timestamps de intentos.
- Eliminar intentos que quedan fuera de la ventana.
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

---

## Correccion de legibilidad: evitar `undefined` como placeholder

En los tests aparecia esta construccion:

```ts
new RedisRateLimitService(undefined, () => now)
```

Funcionaba porque el constructor era:

```ts
constructor(store?: RateLimitStore, now: () => number = Date.now)
```

Es decir:

- `undefined` significaba "usa el store por defecto".
- `() => now` era el reloj controlado para el test.

Aunque era correcto tecnicamente, no era ideal para aprender ni para mantener el codigo.

El problema es que el lector tiene que conocer el orden exacto de parametros para entenderlo. Ademas, si el constructor cambia en el futuro, ese patron puede volverse fragil.

Se cambio por un factory explicito:

```ts
RedisRateLimitService.inMemoryForTesting(() => now)
```

Ahora el test expresa mejor la intencion:

```text
Quiero una version en memoria del servicio, pensada para tests, con un reloj controlado.
```

Esta es una pequena mejora de diseno, pero importante como habito:

- Los tests deben ser claros.
- Los helpers de test deben explicar la intencion.
- Evitar `undefined` como relleno suele mejorar la legibilidad.

---

## Correccion de algoritmo: contador con TTL no es sliding window real

Durante una nueva revision detectamos un matiz importante en `RedisRateLimitService`.

La primera implementacion guardaba:

```text
contador + expiracion
```

Eso puede servir para una fixed window o para un contador con TTL renovado, pero no representa exactamente una sliding window real.

El problema es que no conserva informacion individual de cada intento.

Por ejemplo, con un contador simple:

```text
00:00 -> intento 1
00:09 -> intento 2
00:18 -> intento 3
00:27 -> intento 4
00:36 -> intento 5
```

Si el TTL se renueva en cada intento, el contador podria llegar a 5 y bloquear.

Pero esos 5 intentos no ocurrieron dentro del mismo periodo de 10 minutos.

Por tanto, para cumplir correctamente:

```text
5 intentos fallidos en un periodo de 10 minutos
```

no basta con guardar un contador.

Hay que guardar timestamps, o una estructura equivalente, y contar solo los intentos que siguen dentro de la ventana temporal.

---

## Implementacion corregida

El store ahora expone:

```ts
recordAttempt(key: string, occurredAt: number, windowSeconds: number): Promise<number>
```

La version en memoria guarda un array de timestamps por clave.

Cuando llega un intento:

```ts
const windowStart = occurredAt - windowSeconds * 1000
const activeAttempts = attempts.filter((attemptAt) => attemptAt >= windowStart)
activeAttempts.push(occurredAt)
```

Asi solo se cuentan intentos activos dentro de:

```text
[ahora - ventana, ahora]
```

En una implementacion Redis real, este patron podria mapearse bien a un Sorted Set:

```text
ZADD account_fail:{email} timestamp timestamp
ZREMRANGEBYSCORE account_fail:{email} -inf windowStart
ZCARD account_fail:{email}
EXPIRE account_fail:{email} windowSeconds
```

La idea importante no es la estructura exacta, sino la propiedad:

```text
El contador de bloqueo debe derivarse de intentos todavia vigentes dentro de la ventana.
```

---

## Tests anadidos para capturar este bug

Se anadieron tests que habrian fallado con un contador de TTL renovado:

```text
Intentos individualmente cercanos, pero repartidos fuera de la misma ventana.
```

Ejemplo conceptual:

```text
00:00 -> intento
00:09 -> intento
00:18 -> intento
00:27 -> intento
00:36 -> intento
```

Cada intento esta a menos de 10 minutos del anterior, pero los 5 no pertenecen a una unica ventana de 10 minutos.

Resultado esperado:

```text
No bloquear.
```

Tambien se anadio el mismo tipo de test para IP usando la ventana de 5 minutos.

---

## Segunda leccion aprendida

Cuando un requerimiento habla de "N eventos en una ventana temporal", hay que distinguir:

- Fixed window: contador que se reinicia por bloques de tiempo.
- Sliding expiration counter: contador cuyo TTL se renueva con cada evento.
- Sliding window real: conteo de eventos con timestamp dentro de `[ahora - ventana, ahora]`.

Son parecidos en lenguaje informal, pero no son equivalentes.

Para seguridad y rate limiting, esta diferencia importa mucho.

---

## Limitacion del store en memoria: concurrencia y varios servidores

El `InMemoryRateLimitStore` es util para tests y desarrollo local, pero no debe entenderse como sustituto de Redis en produccion.

Hay dos motivos principales.

### 1. Concurrencia

En memoria, una operacion suele tener esta forma conceptual:

```text
leer estado actual
calcular nuevo estado
guardar nuevo estado
```

Con varias peticiones simultaneas podria ocurrir una condicion de carrera:

```text
Peticion A lee 4 intentos
Peticion B lee 4 intentos

A calcula 5
B calcula 5

A guarda 5
B guarda 5
```

El resultado correcto deberia reflejar dos nuevos intentos, pero ambas peticiones partieron del mismo estado.

Redis ayuda a resolver esto porque sus operaciones pueden hacerse de forma atomica. Para una sliding window real, una implementacion Redis deberia hacer atomico el conjunto:

```text
eliminar intentos antiguos
anadir intento actual
contar intentos activos
establecer expiracion de limpieza
```

Una forma habitual seria usar un Sorted Set con una transaccion o script Lua.

---

### 2. Multiples servidores

Si hay varios servidores de aplicacion:

```text
Servidor A
Servidor B
Servidor C
```

y cada uno usa su propio `Map`, cada servidor tendria una vision parcial.

Un atacante podria repartir intentos:

```text
4 intentos -> servidor A
4 intentos -> servidor B
4 intentos -> servidor C
```

Ningun servidor individual veria el umbral completo.

Redis resuelve este problema porque todos los servidores consultan el mismo estado compartido:

```text
Servidor A \
Servidor B  -> Redis
Servidor C /
```

Por eso la implementacion en memoria debe considerarse:

- test double;
- fallback local;
- herramienta de desarrollo;
- no almacenamiento distribuido de produccion.

---

## Contrato esperado para una implementacion Redis real

La interfaz `RateLimitStore` ahora documenta una expectativa importante:

```text
recordAttempt debe ser atomico en produccion.
```

Eso significa que una implementacion real no deberia hacer tres llamadas independientes sin proteccion:

```text
ZREMRANGEBYSCORE
ZADD
ZCARD
```

porque entre una y otra podria entrar otra peticion.

Lo adecuado seria agruparlas con una transaccion Redis o con Lua para que el resultado sea consistente.

Este detalle todavia no se implementa porque el proyecto no tiene cliente Redis real instalado, pero queda preparado conceptualmente en el contrato.

---

## Correccion de seguridad de configuracion: sin fallback implicito en produccion

Tras revisar el codigo completo antes del push, detectamos otro riesgo:

```ts
new RedisRateLimitService()
```

Si el constructor crea automaticamente un store en memoria cuando no recibe nada, entonces el sistema podria arrancar accidentalmente con un rate limit local.

Eso seria peligroso porque:

- no es atomico;
- no comparte estado entre servidores;
- no representa una configuracion Redis real;
- podria dar una falsa sensacion de proteccion en produccion.

Por eso se cambio el constructor para exigir explicitamente un `RateLimitStore`:

```ts
constructor(store: RateLimitStore, now: () => number = Date.now)
```

Y se dejaron factories con nombre para los casos no productivos:

```ts
RedisRateLimitService.inMemoryForTesting(() => now)
RedisRateLimitService.inMemoryForLocalDevelopment()
```

En `main.ts`, si `NODE_ENV` es `production`, el arranque falla con un mensaje claro hasta que exista un store Redis compartido y atomico:

```text
Production RateLimitService requires a shared atomic Redis store
```

Esta decision hace que el sistema falle temprano en una mala configuracion, que es mejor que arrancar con una proteccion de seguridad incompleta.

---

## Revision pre-push: artefactos generados

Antes de subir la rama a GitHub se ejecuto:

```bash
npm run build
```

El build funciono, pero genero la carpeta:

```text
dist/
```

Como el proyecto no tenia `.gitignore`, esa carpeta aparecia como archivo sin trackear y podria entrar accidentalmente en una PR.

Se anadio un `.gitignore` minimo para un proyecto Node/TypeScript:

```text
node_modules/
dist/
coverage/
.env
```

Esto evita subir:

- dependencias instaladas;
- artefactos compilados;
- reportes de cobertura;
- variables de entorno o secretos locales.

Despues de anadirlo se repitio el build y `dist/` ya no ensucio el estado de Git.

---

## Tarea 6: punto de control de servicios de infraestructura

La tarea 6 no pedia implementar una pieza nueva, sino parar y verificar que lo construido hasta ahora seguia siendo coherente.

Esto es importante porque ya tenemos varias piezas de infraestructura conectadas:

- `AuditService`, que registra eventos de auditoria mediante un repositorio.
- `RedisRateLimitService`, que protege contra intentos fallidos por cuenta y por IP.
- Tests de dominio, aplicacion e infraestructura.
- Protecciones de configuracion para no usar almacenamiento en memoria por accidente en produccion.

En este punto se ejecutaron estas comprobaciones:

```bash
npm run typecheck
npm test -- --runInBand
npm run build
git diff --check
```

Resultado:

- TypeScript compila sin errores de tipos.
- La suite de tests pasa completa: 3 suites y 37 tests.
- El build de produccion se genera correctamente.
- No hay errores de espacios detectados por Git.

Tambien se reviso que las clases todavia no implementadas pertenezcan a tareas posteriores, por ejemplo `TokenService`, `PasswordHasher`, `EmailService` y controladores. Esos stubs no bloquean esta tarea porque forman parte del plan incremental.

La idea practica de este checkpoint es sencilla: antes de seguir construyendo encima, confirmamos que la base no se ha torcido. Asi, si en la siguiente tarea aparece un fallo, sera mucho mas facil acotar si viene del cambio nuevo y no de una deuda silenciosa anterior.

---

## Tarea 7: TokenService, JWT RS256 y refresh tokens

En esta tarea se implemento la gestion de tokens en dos niveles para separar responsabilidades:

- `JwtTokenService`, en infraestructura, se encarga solo de firmar y verificar access tokens JWT con RS256.
- `TokenService`, en aplicacion, coordina la emision de access tokens y la vida de los refresh tokens usando `ITokenRepository`.

### Access tokens JWT

Los access tokens ahora:

- usan algoritmo `RS256`;
- incluyen `iat`, `exp` y `jti`;
- expiran a los 15 minutos;
- rechazan tokens expirados;
- rechazan tokens con firma manipulada;
- rechazan tokens con roles fuera del enum real del sistema.

No se ha usado una dependencia externa tipo `jsonwebtoken`; se ha implementado con `crypto` de Node para mantener el proyecto ligero en esta fase y entender bien las piezas: header, payload, firma, base64url y verificacion.

### Seguridad de claves

Las claves privadas y publicas no se suben a GitHub.

El servicio lee las rutas desde configuracion:

```text
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

Y se actualizo `.gitignore` para ignorar:

```text
keys/
*.pem
```

Tambien se creo `.env.example`, pero solo con placeholders y rutas de ejemplo. El archivo real `.env` sigue ignorado.

La idea importante es esta:

- `.env.example` se puede commitear porque ensena que variables existen.
- `.env` no se commitea porque contiene valores reales.
- `keys/private.pem` no se commitea porque es material criptografico privado.

### Refresh tokens

Los refresh tokens se implementaron como tokens opacos: el cliente recibe un valor aleatorio, pero en base de datos solo se guarda su SHA-256.

Eso significa que si alguien leyera accidentalmente la tabla `refresh_tokens`, no tendria directamente los tokens utilizables por los clientes.

La duracion depende del rol:

- `ADMIN`: 1 dia.
- `COACH`: 7 dias.
- `ATHLETE`: sin expiracion temporal, solo revocacion.

Esta regla viene del requerimiento 8.

### Rotacion

Cuando se consume un refresh token valido:

1. Se calcula su hash.
2. Se busca en el repositorio.
3. Se rechaza si no existe, esta revocado o esta expirado.
4. Se revoca el token actual.
5. Se emite un nuevo refresh token para el mismo usuario/dispositivo.

Esto reduce el riesgo de reutilizacion: un refresh token usado deja de ser el valor valido para esa sesion.

### Tests anadidos

Se anadieron tests unitarios y de propiedad, siguiendo la piramide de test:

- JWT con expiracion exacta de 15 minutos y `jti` unico.
- Rechazo de JWT expirado.
- Rechazo de JWT manipulado.
- Rechazo de JWT mal formado.
- Rechazo de JWT firmado pero con rol invalido.
- Duracion de refresh token segun rol.
- Comprobacion de que el token opaco no se guarda en claro.
- Rotacion de refresh token valido.
- Rechazo de refresh tokens revocados, expirados o desconocidos.

No se han creado tests E2E en esta fase porque aun no esta implementado el controlador HTTP completo. La equivalencia HTTP 401 de algunos rechazos se comprobara cuando se implemente el caso de uso/controlador de refresco.

### Resultado de verificacion

Se ejecuto:

```bash
npm run typecheck
npm test -- --runInBand
npm run build
```

Resultado:

- TypeScript sin errores.
- 5 suites de test pasando.
- 47 tests pasando.
- Build correcto.

---

## Correccion sobre refresh tokens: rol actual, historial y consumo atomico

Tras revisar la implementacion de la tarea 7 aparecieron tres puntos importantes de seguridad.

### 1. No confiar en el rol guardado en el refresh token para decisiones actuales

El refresh token guardaba tambien el `role` del usuario. Eso puede ser util como dato historico, pero no debe ser la fuente principal para emitir nuevos permisos.

Ejemplo peligroso:

1. Un usuario era `ADMIN` cuando se emitio el refresh token.
2. Dias despues se le baja a `COACH`.
3. Usa el refresh token antiguo.
4. Si el sistema confiara en `refreshToken.role`, podria seguir tratandolo como `ADMIN`.

Para evitarlo, `TokenService.verifyAndConsumeRefreshToken()` ahora consulta el usuario actual mediante `IUserRepository.findById()` antes de rotar el token.

La rotacion usa:

```ts
currentUser.role
```

y no:

```ts
record.role
```

Ademas, el resultado de `verifyAndConsumeRefreshToken()` devuelve `currentUser`, para que los futuros casos de uso no tengan que reutilizar datos historicos del token cuando emitan un nuevo access token.

### 2. Evitar reutilizar la misma fila al rotar

Antes, `PostgresTokenRepository.saveRefreshToken()` usaba:

```sql
ON CONFLICT (user_id, device_id) DO UPDATE
```

Eso hacia que una rotacion sobrescribiera la fila anterior.

El problema es que una carrera de concurrencia podia interactuar mal con esa misma fila:

1. Peticion A y peticion B leen el mismo refresh token valido.
2. A lo consume.
3. A rota y actualiza la misma fila con el nuevo token.
4. B intenta consumir la misma fila, pero ahora podria estar viendo una fila activa otra vez.

Para evitarlo, ahora cada refresh token emitido queda como una fila historica nueva. La fila antigua se marca como revocada y la nueva se inserta aparte.

Esto permite detectar que un token antiguo reaparece como token ya revocado.

### 3. Consumo atomico del refresh token

El repositorio incorpora ahora:

```ts
consumeRefreshToken(tokenId, tokenHash): Promise<boolean>
```

En PostgreSQL se implementa con un `UPDATE` condicional:

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE id = $1
  AND token_hash = $2
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
```

La idea es que solo una peticion puede pasar de:

```text
revoked_at IS NULL
```

a:

```text
revoked_at = NOW()
```

Si dos peticiones intentan consumir el mismo token a la vez, una gana y la otra recibe `false`. Entonces `TokenService` rechaza la segunda con:

```text
Refresh token already consumed
```

y no emite otro refresh token.

### 4. Un solo refresh token activo por dispositivo

La migracion ahora permite historial de tokens, pero mantiene la regla de un token activo por dispositivo mediante un indice parcial:

```sql
CREATE UNIQUE INDEX idx_refresh_tokens_one_active_device
  ON refresh_tokens(user_id, device_id)
  WHERE revoked_at IS NULL;
```

Esto significa:

- puede haber muchos tokens historicos para el mismo dispositivo;
- solo uno puede estar activo a la vez.

### 5. Sobre `deviceInfo?: DeviceInfo | null`

Se simplifico la API publica a:

```ts
 deviceInfo?: DeviceInfo
```

Dentro del servicio, si no llega valor, se guarda como `null` en la entidad/DB.

Asi evitamos exponer tres estados distintos (`undefined`, `null`, objeto) cuando realmente no estamos diferenciando semanticamente entre `undefined` y `null` a nivel de llamada.

### 6. Reuse detection avanzada

Todavia no se implemento una familia de tokens con `tokenFamilyId`, `parentTokenId` o `reusedAt`.

Eso seria una mejora avanzada para detectar robo de refresh tokens y revocar toda la familia si reaparece un token antiguo.

Lo que si queda cubierto ahora es la parte critica inmediata:

- un mismo refresh token no puede consumirse dos veces;
- los tokens antiguos no se sobrescriben;
- un replay no genera nuevos tokens;
- la rotacion usa el rol actual del usuario.

### Tests nuevos de esta correccion

Se anadieron pruebas para comprobar que:

- la rotacion crea una fila nueva y revoca la historica;
- un refresh token consumido no puede reutilizarse;
- si el consumo atomico pierde la carrera, no se emite un token nuevo;
- la rotacion usa el rol actual del usuario, no el rol historico guardado en el refresh token;
- si el usuario ya no existe, el refresh token se rechaza.

---

## Correccion final de rotacion: operacion atomica completa

Despues de la correccion anterior quedaba una mejora importante: aunque el consumo del token viejo era atomico, la rotacion completa seguia ocurriendo en dos pasos desde `TokenService`:

```text
1. consumir token viejo
2. insertar token nuevo
```

Eso evitaba que dos peticiones ganasen a la vez, pero dejaba una inconsistencia posible:

```text
A se consume correctamente
B falla al insertarse
```

Resultado: el usuario podia quedarse sin refresh token valido.

Para corregirlo, el contrato del repositorio cambio de:

```ts
consumeRefreshToken(...)
```

a:

```ts
rotateRefreshToken(...)
```

La diferencia conceptual es importante:

- `consumeRefreshToken` solo representaba media operacion.
- `rotateRefreshToken` representa la operacion completa: consumir viejo + crear nuevo.

En PostgreSQL se implemento con una sola sentencia usando CTE:

```sql
WITH consumed AS (
  UPDATE refresh_tokens
  SET revoked_at = NOW()
  WHERE id = $1
    AND token_hash = $2
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING ...
), rotated AS (
  INSERT INTO refresh_tokens (...)
  SELECT ...
  FROM consumed
  RETURNING ...
)
SELECT ...
FROM consumed
CROSS JOIN rotated
```

Esto tiene una propiedad muy buena: si `consumed` no actualiza ninguna fila, `rotated` no inserta nada. Y al ser una sola sentencia SQL, PostgreSQL la ejecuta de forma atomica.

Asi cubrimos las dos garantias:

1. Solo una peticion puede consumir el refresh token viejo.
2. No existe un estado intermedio donde el token viejo queda consumido pero el nuevo no se crea.

Tambien se introdujeron errores tipados:

```ts
RefreshTokenNotFoundError
RefreshTokenRevokedError
RefreshTokenExpiredError
RefreshTokenAlreadyConsumedError
RefreshTokenUserNotFoundError
```

Esto prepara mejor los futuros controladores HTTP. En vez de depender de comparar strings, podran hacer:

```ts
if (error instanceof RefreshTokenExpiredError) {
  // responder 401 con mensaje adecuado
}
```

Los tests se actualizaron para verificar tanto la rotacion atomica del repositorio como las clases de error lanzadas por `TokenService`.

---

## Modificacion 3: Implementacion de `RoleService` (Tarea 8)

### Contexto

La tarea 8 del plan pide construir el componente encargado de las reglas de roles del sistema:

- decidir que rol puede crear a otro;
- validar si un usuario tiene el rol requerido para una accion;
- permitir el cambio de rol de un usuario solo cuando quien lo solicita sea Administrador;
- cubrir esas reglas con pruebas de propiedad.

Esta parte aterriza varios requerimientos importantes del sistema:

- 1.1 y 1.2: un Administrador puede crear cuentas `ADMIN` y `COACH`;
- 1.7: un no-Administrador no puede crear cuentas `ADMIN`;
- 2.7: el registro publico solo puede crear `COACH`;
- 3.1 y 3.7: un `COACH` puede crear `ATHLETE`, pero no otros roles;
- 9.1: solo existen `ADMIN`, `COACH` y `ATHLETE`;
- 9.3, 9.4 y 9.5: solo `ADMIN` puede modificar roles;
- 9.6: cuando un usuario no tiene permisos, el sistema debe poder rechazarlo.

En otras palabras, `RoleService` no es un detalle cosmetico: es la pieza que concentra la jerarquia real del sistema.

---

### Que se ha creado

### 1. Puerto `IRoleService`

Archivo:

```text
src/modules/auth/application/ports/IRoleService.ts
```

Se definio el contrato de aplicacion para el gestor de roles:

```ts
export interface IRoleService {
  assignRole(targetUserId: string, newRole: Role, requesterId: string): Promise<void>
  validatePermission(userId: string, requiredRole: Role): Promise<boolean>
  canCreateRole(requesterRole: Role | null, targetRole: Role): boolean
}
```

La idea importante aqui es separar:

- el **contrato** que necesita la aplicacion;
- de la **implementacion concreta** de las reglas.

Esto ayuda a mantener la arquitectura limpia y hace posible sustituir o testear el servicio con dobles en memoria si alguna vez hiciera falta.

---

### 2. Servicio `RoleService`

Archivo:

```text
src/modules/auth/application/services/RoleService.ts
```

Se implemento el servicio real con tres responsabilidades.

#### `canCreateRole(requesterRole, targetRole)`

Codifica la tabla de permisos de creacion:

- `ADMIN` puede crear `ADMIN` y `COACH`;
- `COACH` puede crear `ATHLETE`;
- `ATHLETE` no puede crear ninguno;
- `null` representa registro publico y solo puede crear `COACH`.

Ese `null` merece una explicacion: se uso para representar que no existe usuario autenticado que haga la solicitud, que es justo el caso del registro publico. Asi evitamos inventar un rol falso como `"PUBLIC"` que no pertenece al dominio real.

#### `validatePermission(userId, requiredRole)`

Busca el usuario en repositorio y comprueba si tiene exactamente el rol requerido.

Si el usuario no existe, falla.
Si existe pero no tiene el rol correcto, falla.
Si lo tiene, devuelve `true`.

Esto esta pensado para que, en tareas futuras, controladores, middlewares o casos de uso puedan depender de una comprobacion centralizada en vez de repetir comparaciones de strings por todo el codigo.

#### `assignRole(targetUserId, newRole, requesterId)`

Hace tres comprobaciones en orden:

1. el nuevo rol debe ser valido;
2. quien solicita el cambio debe existir y ser `ADMIN`;
3. el usuario destino debe existir.

Solo si todo eso se cumple se actualiza el rol del usuario en `IUserRepository.update(...)`.

Esto cubre una decision importante del diseño: el cambio de rol no vive en el controlador ni se deja “implícito” en el repositorio. Vive en aplicacion porque es una **regla de negocio**, no una simple operacion tecnica.

---

### 3. Validacion explicita de roles con `isValidRole`

`RoleService` reutiliza el value object ya existente:

```ts
isValidRole(value: string): value is Role
```

Esto evita aceptar silenciosamente strings arbitrarios como:

```text
ROOT
SUPERADMIN
PUBLIC
moderator
```

Ese detalle importa mucho. Si el sistema permitiera valores fuera del enum real:

- se romperia el requerimiento 9.1;
- aparecerian estados imposibles en base de datos;
- los permisos dejarian de ser predecibles;
- otros servicios podrian tomar decisiones incorrectas.

Por eso `RoleService` no “confia” en que el tipo TypeScript llegue siempre bien. Tambien valida en tiempo de ejecucion.

---

### 4. Errores tipados para roles

Archivo:

```text
src/modules/auth/application/errors/RoleErrors.ts
```

Se añadieron errores especificos:

```ts
RoleError
InvalidRoleError
UserNotFoundError
InsufficientRoleError
RoleAssignmentForbiddenError
```

La motivacion es la misma que ya vimos con refresh tokens: preparar el camino para que mas adelante los controladores HTTP no dependan de comparar mensajes de texto.

Por ejemplo, en una futura capa HTTP sera mucho mas claro hacer algo como:

```ts
if (error instanceof RoleAssignmentForbiddenError) {
  // responder 403
}
```

que hacer algo asi:

```ts
if (error.message.includes('administrator')) {
  // responder 403
}
```

Los errores tipados hacen el sistema mas mantenible y menos fragil.

---

### 5. Exportaciones y cableado

Se actualizaron varios puntos para que el nuevo servicio forme parte de la API interna del modulo:

- `src/modules/auth/application/services/index.ts`
- `src/modules/auth/application/ports/index.ts`
- `src/modules/auth/application/errors/index.ts`
- `src/main.ts`

En `main.ts` se añadio:

```ts
const _roleService = new RoleService(_userRepository)
```

Esto mantiene la regla de composicion centralizada: las dependencias concretas se instancian en el composition root, no dentro del propio servicio.

Aunque todavia no haya un caso de uso o controlador terminado consumiendo `RoleService`, dejarlo cableado aqui ayuda a mantener el proyecto coherente tarea a tarea.

---

### 6. Pruebas property-based y pruebas unitarias

Archivo:

```text
src/modules/auth/application/services/__tests__/RoleService.test.ts
```

Se añadieron pruebas en memoria con un `InMemoryUserRepository`, siguiendo el mismo estilo usado en otras tareas.

#### Propiedad 3: permisos de creacion de cuentas

Se generan combinaciones de:

- rol solicitante: `ADMIN`, `COACH`, `ATHLETE` o `null` para registro publico;
- rol objetivo: `ADMIN`, `COACH`, `ATHLETE`.

Y se comprueba que `canCreateRole(...)` cumple exactamente la tabla esperada.

Esto es util porque no prueba solo “casos bonitos”, sino muchas combinaciones automaticamente.

#### Propiedad 20: solo `ADMIN` puede modificar roles

Se verifica que:

- si quien solicita es `COACH` o `ATHLETE`, `assignRole(...)` rechaza la operacion;
- el rol del usuario destino no cambia por accidente.

Ese segundo punto es importante: no basta con lanzar error, tambien hay que comprobar que no hubo efectos colaterales.

#### Propiedad 19: solo se aceptan roles validos

Se generan strings arbitrarios fuera del conjunto valido y se comprueba que el servicio responde con `InvalidRoleError`.

Esta prueba protege muy bien contra “valores fantasma” que a veces aparecen al integrar formularios, APIs o datos externos.

#### Pruebas adicionales de `validatePermission`

Ademas se cubrieron tres casos directos:

- devuelve `true` si el usuario tiene el rol requerido;
- rechaza si el rol no coincide;
- rechaza si el usuario no existe.

Con esto queda cubierta tanto la parte de jerarquia como la parte de autorizacion puntual.

---

### Por que `RoleService` vive en Application y no en Infrastructure

Esto merece una pausa porque es una decision arquitectonica importante.

`RoleService` no habla con HTTP.
`RoleService` no ejecuta SQL directamente.
`RoleService` no depende de Express, Redis ni PostgreSQL.

Lo que hace es aplicar reglas del negocio:

- quien puede crear a quien;
- quien puede cambiar roles;
- que roles existen realmente;
- que pasa cuando falta permiso.

Eso significa que pertenece a la capa **Application**.

La infraestructura solo aporta el detalle tecnico necesario para consultar o actualizar usuarios mediante `IUserRepository`.

Dicho de otra forma:

- `PostgresUserRepository` sabe **como** guardar un cambio de rol;
- `RoleService` sabe **cuando** ese cambio esta permitido.

Separar ambas cosas hace el codigo mas facil de entender, testear y mantener.

---

### Decisiones pequeñas pero importantes

#### 1. Usar `null` para registro publico

En `canCreateRole`, el registro publico se representa con `requesterRole = null`.

Eso es mejor que:

- inventar un cuarto rol que no existe en requerimientos;
- meter un string especial fuera del enum;
- duplicar otra funcion distinta solo para registro publico.

Es una forma sencilla de expresar “no hay usuario autenticado”.

#### 2. `validatePermission` exige coincidencia exacta

En esta primera version no se implemento una jerarquia implicita tipo:

```text
ADMIN hereda permisos de COACH
COACH hereda permisos de ATHLETE
```

Se opto por comparacion exacta de rol porque es lo mas fiel al diseño actual y evita asumir una semantica no descrita en requerimientos.

Si mas adelante el proyecto necesita permisos jerarquicos para acceso a recursos, podremos evolucionarlo de forma explicita. Pero por ahora es mejor no inventar reglas.

#### 3. `assignRole` valida tambien la existencia del objetivo

Puede parecer obvio, pero es un buen ejemplo de por que un servicio de aplicacion aporta valor:

- no basta con saber que el solicitante es `ADMIN`;
- tambien hay que controlar que el usuario destino exista antes de modificarlo.

Esto concentra el flujo completo en un solo sitio.

---

### Como se verifico

Se ejecutaron estas comprobaciones:

```bash
npm run typecheck
npm test -- RoleService.test.ts
```

Resultado:

- `typecheck` correcto;
- suite de `RoleService` pasando con 7 tests en verde.

---

### Resumen didactico

Con esta tarea el proyecto gana una pieza central de autorizacion basada en roles.

Lo mas importante no es solo que ahora exista un `RoleService`, sino **como** se construyo:

- con reglas concentradas en un unico servicio;
- con validacion en runtime ademas de tipos;
- con errores tipados;
- con pruebas de propiedad para cubrir muchas combinaciones;
- y respetando la separacion entre negocio (`Application`) y persistencia (`Infrastructure`).

Esto deja el terreno preparado para que las siguientes tareas, como `UserService`, no tengan que inventar por su cuenta las reglas de creacion o cambio de roles. Simplemente podran apoyarse en esta pieza ya definida.
