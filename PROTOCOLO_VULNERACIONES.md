# Protocolo ante una vulneración de seguridad (art. 19)

El art. 19 de la Ley obliga a informar **de forma inmediata** a las personas titulares cuando una vulneración de seguridad afecte de
forma significativa sus derechos patrimoniales o morales, para que puedan defenderse. Este protocolo es una guía para la asociación.

## 1. Detectar y contener (primeras horas)
- Señales: accesos extraños en *Administración → Bitácora/Auditoría*, usuarios que no reconocen, correos de recuperación que nadie pidió,
  respaldo o laptop perdidos, mensajes enviados por error a otra persona.
- Contener: desactivar las cuentas implicadas (Administración → Usuarios), **cambiar** `JWT_SECRET` y `JWT_REFRESH_SECRET` en Render
  (cierra todas las sesiones), rotar la contraseña de la base de datos en Supabase y quitar accesos que ya no se usen.
- **Conservar evidencia**: no borrar bitácora ni auditoría; anotar fecha, hora y quién lo descubrió.

## 2. Evaluar (mismo día)
- ¿Qué datos? ¿De cuántas personas? ¿Eran **sensibles** (salud) o de menores? ¿Estaban cifrados? (Los datos de salud y los respaldos
  van cifrados: si solo se filtró un respaldo cifrado y la llave `DATA_ENC_KEY` no se comprometió, el riesgo baja mucho.)
- ¿Puede afectar de forma **significativa** los derechos de esas personas (suplantación, discriminación, daño económico o moral)?

## 3. Informar (inmediatamente si es significativa)
Mensaje claro a cada persona titular afectada (o a su tutor), con: qué ocurrió y cuándo; qué datos se vieron afectados; qué hizo ya la
asociación; qué puede hacer la persona para protegerse; y un contacto (persona designada y correo ARCO del aviso).

## 4. Corregir y registrar
- Corregir la causa (parche, cambio de llaves/contraseñas, capacitación) y documentarla.
- Dejar un registro interno con fecha, alcance, decisiones y avisos enviados.
- Si la causa fue una llave de cifrado comprometida: generar llave nueva, re-cifrar y ver `SEGURIDAD_Y_PRIVACIDAD.md`.

## 5. Después
Revisar si hay que modificar el aviso de privacidad o las medidas de seguridad, y consultar a la representación legal si debe
presentarse alguna denuncia u otra comunicación a una autoridad.
