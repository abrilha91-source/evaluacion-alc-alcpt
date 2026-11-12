# Instructivo v0.4 · Evaluación Oficial ALC / ALCPT (Esc. Mil. Enfría.)

Versión SIN internet (`app/`). La versión CON internet (`online/`) sigue en v0.3: no se actualizó en esta entrega.

## 1. Qué cambió en la v0.4
- **Solo evaluaciones formales.** La app sirve exclusivamente para:
  - ALC · Evaluación parcial (1.ª, 2.ª o 3.ª);
  - ALCPT · Diagnóstico;
  - ALCPT · Final;
  - ALCPT · Seguimiento (según lo ordenado).
  
  No hay práctica, demostración ni inicio libre. Para practicar se usa la otra app, «Misión: Obtener la Barra I».
- **Un examen solo inicia con el código y el PIN que emite la Administración.** El código fija el tipo de evaluación, la forma y la ventana de fechas.
- **Nadie fuera de la Administración puede saber qué forma se aplica.** Eso incluye al cadete, al aplicador, a la Directora y al piloto.
  - **Datos públicos:** la app solo contiene bloques cifrados del mismo tamaño, con nombres aleatorios, mezclados con bloques señuelo. No hay lista de formas, títulos, números, tamaños ni claves.
  - **Código y pantallas:** la forma va cifrada dentro del código y solo se abre con el PIN. Ni el código legible ni las pantallas del cadete la muestran.
  - **Resultado:** la forma viaja sellada solo para la Administración.
  - El orden aleatorio por cadete se conserva.
- **Perfiles nuevos:** Directora (solo consulta) y Usuario piloto. Hay además una bitácora completa de actividad y adjuntos de formas oficiales.

## 2. Perfiles
| Perfil | Qué puede hacer | Qué NO puede hacer |
|---|---|---|
| **Administración** (Cap. Abril Mejía) | Control total: formas, aprobar, emitir códigos de evaluación y de personal, resultados con forma y calificación, bitácora de todos, adjuntos, revocar | — |
| **Directora (solo consulta)** | Ver Resumen, Evaluaciones, Resultados (% y calificación 0–10, incidentes y evidencia) y Personal, con el **paquete de consulta** que le envía la Administración. Exportar su bitácora | Modificar, aprobar, emitir o revocar códigos, importar bancos o borrar. Nunca recibe formas, PIN, códigos de evaluación, claves ni adjuntos |
| **Docente aplicador** | Recibir los resultados de las evaluaciones donde lo designen, dar acuses y exportar resultados y bitácora | Emitir exámenes, ver la forma o la calificación |
| **Usuario piloto** | «Prueba del dispositivo»: recorre el flujo del examen (pantalla completa, bloques con y sin audio, audio máximo 2 veces, incidentes, cierre al 3.º) con 5 reactivos **neutros de funcionamiento** | No es práctica ni evaluación: no usa formas, no guarda resultados ni calificación. Solo queda en la bitácora |
| **Cadete** | Presentar la evaluación con el código y el PIN; todo en inglés | Ver la forma, la clave o su calificación |

**Alta de Directora, aplicador o piloto (una vez por dispositivo):**
1. En Inicio, la persona toca su perfil y luego «Registrar este dispositivo», con nombre y frase de acceso. Se le genera una **solicitud** (SOL1, no contiene secretos).
2. La Administración entra en **Personal**, elige el **Perfil**, pega la solicitud, fija la vigencia (máximo 31 días) y toca «Emitir código».
3. Confirmen la **huella del dispositivo** por voz.
4. La persona pega el código en «Mi código». El código solo sirve en ese dispositivo y en ese perfil: el código de piloto no entra como Directora, y viceversa.

**Paquete de consulta para la Directora:** en Personal, junto al código vigente de la Directora, toca «Paquete de consulta» y envíale el texto o archivo. Ella lo pega en Resumen → «Abrir paquete». Solo se abre en su dispositivo. Es una foto del momento: para actualizarlo, genera otro.

## 3. Flujo de la Administración: elegir tipo y forma
1. **Formas.** Aprueba solo las formas que verificaste. Solo las aprobadas pueden recibir códigos. La lista de formas existe únicamente en tu llavero cifrado.
2. **Evaluaciones → Emitir:**
   1. **Tipo de evaluación** (ALC parcial, ALCPT diagnóstico, final o seguimiento).
   2. **Forma.** La lista se filtra según el tipo: ALC solo muestra formas ALC; ALCPT, solo formas ALCPT.
   3. **Número de parcial** (solo ALC).
   4. **Ventana** (máximo 24 h), **duración**, **reproducciones de audio** y, si quieres, el **aplicador que recibe** los resultados.
   5. «Generar código y PIN».
3. **Entrega:**
   - El **código** puede enviarse antes: sin el PIN no abre nada ni revela la forma.
   - El **PIN** se dicta solo al iniciar.
   - Recomendación: **un código por grupo o sesión**, para que un grupo no pase preguntas al siguiente.
4. **Resultados:** solo tú ves la forma y la calificación. Pega el RS2 o importa el `.evres` del aplicador; el archivo del aplicador trae también su bitácora.
5. **Datos sin internet:** en cada dispositivo de cadete, «Preparar para uso sin internet» baja **todos** los bloques, iguales para todos, así que no delata la forma. Si una forma importada no está en la app publicada, en Importar banco se descarga un archivo `datos_evaluacion_xxxxxx.evd` con nombre neutro. Se importa en Inicio → «Importar datos (.evd)».
6. Si se reconstruye o republica la app, los códigos ya emitidos dejan de servir. Emite códigos nuevos.

## 4. Bitácora de actividad (solo la Administración la ve completa)
- Cada dispositivo registra **quién** (nombre), **perfil**, **dispositivo** (identificador aleatorio y resumen del equipo: sistema, navegador, pantalla, si está instalada), **fecha y hora** y la **acción**.
- **Acciones registradas:**
  - inicios y cierres de sesión, accesos fallidos y bloqueo por inactividad;
  - vistas de cada sección;
  - códigos emitidos (de evaluación, de personal y paquetes de consulta) y revocaciones;
  - códigos abiertos o rechazados, inicio de examen, bloque inicial, incidentes, cierre y entrega;
  - acuses;
  - importaciones y exportaciones;
  - pruebas del piloto;
  - adjuntos.
- **Encadenada con hashes.** Si alguien edita o borra un registro intermedio, la cadena sale **«ALTERADA»**. Además, al importar de nuevo la bitácora de un dispositivo, se comparan los registros que ya habías recibido.
- **Cómo llega a la Administración, sin internet:**
  - **Directora, piloto y aplicador:** pestaña Bitácora → «Exportar bitácora para la Administración (.evlog)». El archivo va sellado: solo la Administración puede abrirlo. El aplicador la manda además dentro de su `.evres`.
  - **Cadete:** la bitácora de su intento viaja sellada **dentro de su resultado**.
- **En Administración → Bitácora:**
  - importa los `.evlog` o pega su texto;
  - filtra por perfil;
  - **exporta a Excel** o a **JSON verificable**. Esa exportación también queda registrada.

## 5. Adjuntar formas oficiales (solo Administración)
- Pestaña **Adjuntos** → «📎 Adjuntar formas oficiales».
- **Tipos y límites por archivo:**
  - PDF, Word .docx y Excel .xlsx: 25 MB;
  - PNG/JPG: 10 MB;
  - MP3: 25 MB;
  - WAV: 40 MB;
  - MP4: 60 MB.
  
  El tope total es de 400 MB. Se revisa la extensión **y** el contenido, así que un archivo con la extensión cambiada se rechaza.
- **Seguridad de los archivos:**
  - Se quedan **solo en tu dispositivo**, cifrados (AES-256-GCM). La clave está dentro de tu llavero, protegida por tu frase: sin la frase no se abren, y cambiar la frase no obliga a recifrarlos.
  - Nombre, tipo, etiquetas y contenido van cifrados.
  - **No se suben a internet ni se publican.** No los ven Cadete, Piloto, Aplicador ni Directora; por defecto tampoco se mencionan en el paquete de consulta.
- **Qué puedes hacer con cada archivo:**
  - **Etiqueta opcional:** evaluación (ALC parcial con número; ALCPT diagnóstico, final o seguimiento) y forma interna.
  - **Lista:** muestra tipo, tamaño y fecha.
  - **Vista previa:** PDF, imágenes, audio y video. Word y Excel no tienen vista previa sin internet: «Descargar» deja una copia **sin cifrar** en las descargas, así que bórrala después.
  - **Eliminar:** pide confirmación y no se puede deshacer.
- Adjuntar, ver, descargar, etiquetar, eliminar y cada rechazo quedan en la bitácora, sin el nombre del archivo.
- **Almacenamiento:**
  - La pestaña muestra cuánto espacio usa la app y cuánto permite el navegador.
  - En **iPhone/iPad**, Safari puede borrar los datos de sitios que no se usan en varias semanas si la app no está instalada. Instálala en la pantalla de inicio.
  - En cualquier dispositivo, conserva los originales y el respaldo del llavero (Ajustes) fuera del teléfono.
- **Para que una forma se pueda aplicar,** hay que importarla en «Importar banco». Adjuntos guarda el original oficial como respaldo y referencia.

## 6. Límites reales de la v0.4 (además del anexo v0.3)
- **Ya con el PIN, durante el examen:** quien abra herramientas de desarrollo en el dispositivo del cadete puede ver los nombres aleatorios de los bloques de ese examen. No hay forma de relacionarlos con un número de forma.
- **Lo que sí es visible:**
  - El manifiesto público dice cuántos bloques hay en total (con señuelos).
  - El código deja ver el número de parcial, la duración y la ventana.
  - El aplicador ve la longitud de la hoja de respuestas.
- **Compartir el mismo código y PIN** entre grupos permite pasar preguntas. Emite un código por sesión.
- **Bitácora:**
  - Detecta ediciones y borrados intermedios.
  - Quien tenga el dispositivo y conocimientos técnicos podría rehacer **toda** la cadena desde el inicio antes de exportarla. Esto se detecta solo si ya habías importado antes una parte de esa bitácora. Importa las bitácoras con frecuencia.
  - Sin internet, la bitácora de cada dispositivo llega solo cuando se importa su archivo.
- **Adjuntos:**
  - Viven en un solo dispositivo. Si borras los datos del navegador o pierdes el equipo, se pierden. El respaldo del llavero **no** incluye los archivos.
  - Cualquier archivo descargado queda sin cifrar.
- **Historial del repositorio público:** el 12-nov-2026 se reemplazó por un único commit con solo los archivos públicos de la v0.4. Copias anteriores hechas por terceros (forks, clones, cachés de buscadores o del archivo web) no se pueden borrar desde aquí; las formas de la v0.4 usan claves nuevas, así que esas copias no revelan qué forma se aplica.

# Anexo · Instructivo v0.3 (sigue vigente en lo que no cambió la v0.4)

En la v0.4 el resultado sin internet es RS2 (no RS1). El cadete ya no ve títulos de forma: solo el tipo de evaluación.

## Novedades v0.3
- **Todo en inglés para el cadete.** Desde «Soy cadete · I am a cadet» todo lo que ve el cadete está en inglés: código, identificación, aviso de privacidad, reglas, selección de bloque, preguntas, temporizador, avisos de incidente, hoja de respuestas, cierre, calificación y mensajes de error. Administración y docente aplicador siguen en español.
- **Pantalla completa obligatoria.** El examen no inicia hasta que el cadete toca «Enter full screen» y la app ocupa toda la pantalla.
  - Si después la ventana deja de ocupar toda la pantalla o pierde el foco, la vista se **bloquea** (no se ven las preguntas) y se registra **un** incidente por cada episodio. Casos: selector de apps, Split View, Slide Over, Stage Manager, pantalla dividida, ventana flotante o reducida, otra app activa, o salir de pantalla completa.
  - Para seguir, el cadete toca «Return to full screen».
  - La regla no cambia: 1.º y 2.º incidente, advertencia; 3.º, cierre y calificación con lo respondido, con evidencia.
- **iPhone (y iPad sin pantalla completa en el navegador):** hay que **instalar la app** (Compartir → «Agregar a pantalla de inicio») y abrirla desde el ícono. En el navegador normal de iPhone el examen no inicia, porque Safari en iPhone no permite pantalla completa para páginas web.

## Para el cadete (lo verá en inglés)
1. Abre la app, «Soy cadete», escribe el código (y el PIN en la versión sin internet) y tus datos. Acepta el aviso.
2. **Elige con qué bloque empezar:** preguntas CON audio o preguntas SIN audio. Al terminar el primero pasas al otro («Siguiente bloque →»). El tiempo es uno solo para los dos.
3. **Audio:** cada audio se escucha **máximo 2 veces**. No hay barra para adelantar ni regresar. El contador no se reinicia aunque recargues la página.
4. **No traduzcas la página** (traductor de Chrome/Safari/Edge u otra app): cuenta como incidente.
5. **El examen va a pantalla completa y sin otras apps visibles.** No abras el selector de apps, Split View, Slide Over, Stage Manager, pantalla dividida ni ventanas flotantes. No cambies de app o ventana, no imprimas y no tomes capturas. Cada caso es un incidente y la vista se bloquea hasta volver a pantalla completa:
   - 1.º y 2.º incidente: aparece una advertencia («Advertencia 1 de 2», «Advertencia 2 de 2»).
   - **3.º incidente: el examen se cierra solo y se califica con lo que hayas respondido.**
   - Recargar o cerrar la app también cuenta como incidente.
6. El orden de las preguntas y de las opciones es distinto para cada cadete. No sirve copiar «la respuesta 3 es B».

## Para el docente aplicador y el Administrador
- Cada incidente guarda: número, tipo, hora, reactivo y una **imagen generada por la app** con lo que el cadete tenía en pantalla.
- **SIN internet:** la evidencia viaja dentro del resultado cifrado y firmado (código RS1/QR/archivo). En «Resultados» verás «CERRADO POR INCIDENTES» y el botón «Evidencia». La calificación se calcula al abrir el resultado: el equipo del cadete no tiene la clave.
- **CON internet:** el servidor recibe cada incidente con su imagen. Al 3.º, **el servidor** cierra y califica, y el cadete ve «Calificación emitida». En «Resultados» → «Evidencia» se ven las imágenes, y cada consulta queda en la bitácora.
- El Excel trae las columnas Incidentes, Cierre, Bloque inicial y Huella de orden, más una hoja «Incidentes».

## Limitaciones reales (léelas antes de sancionar)
### iPad / iPhone
- **iPhone:** Safari no permite pantalla completa a una página web. Por eso el examen solo inicia con la app instalada en la pantalla de inicio. Instalada, ocupa toda la pantalla y se revisan sus dimensiones, el foco y si pasa a segundo plano.
- **Selector de apps** (deslizar hacia arriba): la página pasa a segundo plano o pierde el foco, y normalmente se detecta. Si el cadete regresa en menos de medio segundo, iOS puede no avisar a la página.
- **Split View y Stage Manager (iPad):** reducen la ventana del examen, y se detectan por dimensiones.
- **Slide Over (iPad):** la app flotante va **encima** sin cambiar el tamaño del examen. Solo se detecta si iPadOS le quita el foco a la página, lo que ocurre cuando el cadete toca la app flotante. Si solo la deja abierta y la lee, **puede no detectarse**.
- **Picture in Picture**, burbujas o ventanas que otras apps dibujan encima (en Android, «mostrar sobre otras apps», como los traductores flotantes o Google Lens) **no cambian la ventana ni el foco del examen y no se detectan**.
- **Un segundo dispositivo** (otro teléfono con traductor) no se detecta. Hace falta supervisión presencial.
- **Notificaciones, llamadas, alarmas o el bloqueo automático** quitan el foco y cuentan como incidente aunque el cadete no haya querido salir. Pide modo **No molestar** y desactivar el bloqueo automático durante el examen. En la versión sin internet también sirve el modo avión.
- En iPad se usa la pantalla completa del navegador. Gestos del sistema (deslizar desde el borde) pueden sacar de pantalla completa: cuenta como incidente.

### Generales
- Una página web **no puede capturar otras apps ni la pantalla real**. La imagen de evidencia la dibuja la app con el estado del examen (pregunta, opciones, marca), **no es una captura del sistema operativo**.
- **Las capturas del sistema no se detectan de forma fiable.** La tecla Impr Pant y algunos atajos (Cmd+Shift+3/4/5, Win+Shift+S) se detectan solo si el sistema se los pasa al navegador. Los botones físicos del teléfono (volumen+encendido) **no se detectan**. Otro celular fotografiando la pantalla tampoco.
- «Cambio de ventana», «perdió el foco» o «sin pantalla completa» también pueden venir de una notificación, una llamada, el bloqueo de pantalla o una ventana del sistema. Revisa la hora y el tipo antes de decidir.
- La revisión de dimensiones usa tolerancias: ancho ≥ 92 % de la pantalla; alto ≥ 85 % a pantalla completa y ≥ 80 % instalada, por las barras del sistema. Una ventana casi completa, por ejemplo 95 % del ancho, no se detecta.
- Girar el dispositivo a pantalla completa no cuenta como incidente: hay medio segundo de gracia.
- (v0.4) El cadete ya no ve títulos de forma: solo el tipo de evaluación en inglés (p. ej. «ALC 2nd Partial Exam»).
- La detección de traducción es de mejor esfuerzo: detecta los traductores integrados más comunes (Chrome/Google, Edge/Microsoft). Una extensión o app externa que no cambie la página no se detecta.
- SIN internet, un cadete que borra los datos del navegador puede reiniciar el intento, y sus incidentes con él. Esto no ocurre en la versión CON internet: el servidor guarda incidentes y reproducciones.
- Bloque de audio pequeño (p. ej. 10 reactivos): dos cadetes coinciden, por azar, en ~1 posición en promedio. En los 40 reactivos, ~2.
- Para evaluaciones con consecuencias, usa la versión CON internet y supervisión presencial.
