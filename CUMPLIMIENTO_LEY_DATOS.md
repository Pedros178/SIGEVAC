# Cumplimiento: Ley Federal de Protección de Datos Personales en Posesión de los Particulares (DOF 20-mar-2025)

La ley de 2010 fue **abrogada** y la de 2025 está vigente desde el 21 de marzo de 2025; la autoridad ya no es el INAI sino la
**Secretaría Anticorrupción y Buen Gobierno**. Este documento relaciona cada obligación con lo que hace el sistema y con lo que le
toca a la asociación (que es la **responsable** del tratamiento; el sistema es una herramienta para cumplir).

> No es asesoría legal. Antes de usar el sistema con datos reales, la representación legal de la asociación debe revisar el aviso
> de privacidad y los puntos de la sección "Lo que hace la asociación". Los artículos citados son los de la ley publicada en el DOF.

## Marco normativo (para la revisión de la abogada)

Verificado en fuentes públicas el día de la redacción; **la abogada debe confirmar el texto vigente** (los textos consultados indican que la
ley tuvo una reforma publicada el 14-nov-2025, y yo analicé el texto original del DOF del 20-mar-2025).

| Norma | Por qué aplica | Estado en el sistema |
|---|---|---|
| **Ley Federal de Protección de Datos Personales en Posesión de los Particulares** (DOF 20-mar-2025; abroga la de 2010) | La asociación es una persona moral de carácter privado que trata datos personales (art. 2, fr. XVI: "sujetos regulados") | Cubierta en lo técnico, ver tabla de abajo; el cumplimiento total depende también de la asociación |
| **Constitución, art. 16** (derechos ARCO) | La propia Ley lo invoca (art. 58, fr. XVII) | Derechos ARCO implementados |
| **Ley General de los Derechos de Niñas, Niños y Adolescentes, arts. 76 a 80** (intimidad y protección de datos de menores; art. 77: manejo de su imagen, nombre y datos) | Hay voluntarios menores de edad y fotografías de actividades | Tutor obligatorio para menores y consentimiento otorgado por el tutor. **Brecha:** sin flujo para consentimiento de fotografías (ver abajo) |
| Legislación estatal de derechos de niñas, niños y adolescentes de Puebla | Menores en Puebla | **No analizada**: la abogada debe revisarla |
| Reglamento y lineamientos de la ley | La ley de 2025 ordenó adecuar la normativa secundaria; el Reglamento de 2011 y los lineamientos del aviso siguen publicados | **No pude confirmar** qué reglamento o lineamientos rigen hoy: la abogada debe verificarlo |
| Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados | Aplica a entes públicos, no a una A.C. privada | No aplica salvo que la abogada determine que por recibir recursos públicos exista alguna obligación de transparencia |

## Brechas conocidas y decisiones que debe tomar la asociación con su abogada

1. **Consentimiento "por escrito" (art. 8).** La ley pide que el consentimiento para datos sensibles conste mediante firma autógrafa, firma electrónica
   o un mecanismo de autenticación. Hoy el sistema solo registra que **quien captura confirma** haberlo obtenido (casilla): es una declaración de la
   asociación, **no la firma de la persona titular**. El documento firmado debe existir y resguardarse (papel o expediente). Mejora recomendada:
   exigir un documento de consentimiento firmado dentro del flujo de firma electrónica del expediente antes de aceptar datos de salud.
2. **Fotografías.** El aviso las declara como finalidad que requiere consentimiento, pero el sistema no tiene todavía pantalla para recabarlo
   (solo existe el registro por API, tipo `finalidades_secundarias`). Mientras tanto, la asociación debe recabarlo por escrito. Para menores, a cargo del tutor.
3. **Texto del aviso.** Lo redacté yo sobre lo que hace el sistema; debe revisarlo y adoptarlo la abogada (domicilio, finalidades reales, plazos de conservación).
4. **Alojamiento fuera de México.** La base de datos está en una región de Estados Unidos (Supabase). Los proveedores de alojamiento tratan datos
   como personas encargadas (no son "transferencia" según el art. 2, fr. XX), pero la abogada decidirá si conviene declararlo expresamente en el aviso
   y formalizar contratos con ellos (art. 13).
5. **Plazos de conservación** y bloqueo (arts. 10, 24, 25): hay que definirlos; el sistema ofrece la herramienta, no la política.
6. **Compromisos de confidencialidad** (art. 20) de quienes capturan datos: documento y firma, fuera del sistema.
7. Los plazos ARCO se cuentan en días hábiles de lunes a viernes, **sin descontar feriados**: la alerta nunca será más corta que el plazo legal.
8. Esto no es una certificación: ningún software "cumple" por sí solo; la responsable es la asociación.

## Lo que el sistema ya hace

| Art. | Obligación | En SIGEVAC |
|---|---|---|
| 7 | Consentimiento; se puede **revocar** sin efectos retroactivos | Registro de consentimientos por tipo (`/api/privacidad/voluntarios/:id/consentimientos`). Revocar el de datos sensibles **elimina** los datos de salud (cesa el tratamiento) |
| 8 | Datos **sensibles**: consentimiento **expreso y por escrito** | El API rechaza (400) guardar tipo de sangre, alergias, discapacidad o enfermedad crónica sin `consentimientoDatosSensibles: true`; queda registrado quién lo otorgó (titular o **tutor** si es menor), medio y versión del aviso. El formulario exige confirmarlo |
| 8 | No crear bases con datos sensibles sin finalidad legítima | Solo se piden para atender emergencias (ver aviso, sección 3) |
| 10, 12 | Suprimir lo innecesario; tratamiento mínimo de sensibles | Panel *Privacidad → Conservación*: lista bajas antiguas para decidir; nada se borra solo |
| 11 | Nuevo consentimiento si cambian las finalidades | El aviso lleva **versión**; cada consentimiento guarda la versión aceptada |
| 14-16 | Aviso de privacidad **integral** y **simplificado** (medios electrónicos) | Página pública `/aviso-privacidad` (integral) y resumen en el formulario público (simplificado, con enlace al integral). Datos propios de la asociación configurables en *Administración → Privacidad*; se marca **incompleto** si faltan |
| 18 | Medidas de seguridad administrativas, técnicas y físicas | Roles y aislamiento por asociación, 2FA opcional, **cifrado de datos de salud y de respaldos**, auditoría que no guarda datos sensibles, límites de peticiones (ver `SEGURIDAD_Y_PRIVACIDAD.md`) |
| 19 | Informar vulneraciones que afecten significativamente | Procedimiento en `PROTOCOLO_VULNERACIONES.md` (el aviso a las personas titulares lo hace la asociación) |
| 20 | Confidencialidad de quienes tratan datos | Permisos por rol; exportar y anonimizar exigen el permiso `privacidad.gestionar`. Falta que las personas voluntarias-capturistas firmen un compromiso (ver abajo) |
| 21-26 | Derechos **ARCO** | Exportar todos los datos de una persona (acceso/portabilidad), solicitudes ARCO registradas, anonimización irreversible (cancelación), rectificación vía edición |
| 26 | Oposición a decisiones **automatizadas** | El "riesgo de abandono" es solo una alerta interna para el equipo; el aviso lo declara. No se toman decisiones automáticas con efectos sobre la persona |
| 29 | Persona o departamento de datos personales | Campo configurable; se muestra en el aviso |
| 31 | **20 días hábiles** para responder y **15 hábiles** para ejecutar; ampliables **una vez** | Fecha límite calculada en días hábiles (lunes a viernes; no descuenta feriados, así que la alerta es conservadora), botón *Ampliar plazo* (una sola vez), alerta de **vencida** |
| 24 | Tras cancelar, **avisar a la persona titular** | Constancia `titular_notificado_en` al cerrar una cancelación |
| 34 | ARCO gratuito | Indicado en el aviso |
| 35 | Cláusula sobre transferencias | El aviso dice que aceptarlo **no** autoriza transferencias; las que existan se piden por separado |

## Lo que hace la asociación (el sistema no puede hacerlo por ella)

1. **Revisar y completar el aviso** en *Administración → Privacidad*: persona designada (art. 29), correo ARCO, domicilio y, si aplica,
   medios adicionales para limitar el uso. Subir la **versión** cada vez que cambie el aviso.
2. **Obtener el consentimiento por escrito** (firma autógrafa o electrónica) antes de capturar datos de salud, y **conservar la
   constancia**. Para menores, lo da el tutor. El sistema registra *que* se obtuvo; el documento firmado lo resguarda la asociación
   (por ejemplo, subido al expediente).
3. **Contratos con los proveedores** que tratan datos por su cuenta (alojamiento Render/Supabase, correo, WhatsApp/Meta): acordar que
   no los usarán para fines propios (art. 13).
4. **Comprometer la confidencialidad** de quienes capturan datos (art. 20), también después de que dejen la asociación.
5. **Responder las solicitudes ARCO a tiempo** y avisar a la persona titular de las cancelaciones.
6. **Fotografías**: pedir consentimiento antes de difundirlas (página pública/redes). Las de `frontend/public/galeria/` ya publicadas
   deben tener autorización de quienes aparecen, sobre todo menores.
7. **Plazos de conservación**: definir con su representante legal cuánto se conservan los datos de bajas (art. 24: bloqueo y supresión;
   art. 25: casos en que no procede cancelar).
8. **Avisar** a las personas titulares si hay una vulneración que afecte de forma significativa sus derechos (art. 19).

## Límites conocidos

- Las **fotos de grupo** en evidencias de actividades no se pueden anonimizar automáticamente.
- El plazo en días hábiles no considera feriados oficiales.
- Los datos de CURP, teléfono, correo y domicilio siguen en claro en la base de datos (se necesitan para operar y buscar); se
  protegen con control de acceso y no con cifrado.
- El sistema no firma por la persona: el consentimiento "por escrito" depende de que la asociación recabe el documento.
